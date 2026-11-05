import {randomUUID} from 'node:crypto';
import type {OwnershipDatabase} from './ownership';
import type {PublicationTarget} from './externalAuthorization';
import type {createPublishingValidationAdapters} from './validationAdapters';
import type {createPublishingCoordination} from './executionCoordination';
export function createFencedTokenRefresh(deps:{database:OwnershipDatabase;validation:ReturnType<typeof createPublishingValidationAdapters>;coordination:ReturnType<typeof createPublishingCoordination>;
 refresh(input:{platform:string;connectionId:string;accountId:string;refreshToken:string|null}):Promise<{accessToken:string;expiresAt:Date;scopes:string;accountId:string;refreshToken?:string;refreshTokenExpiresAt?:Date}>}){
 async function bound(target:PublicationTarget){return deps.database.transaction(async tx=>{
  const row=(await tx.query(`SELECT b."currentVersion",b.state,v."providerAccountId",v."connectionId",s.status,s."accessTokenExpiresAt",to_jsonb(s)->>'refreshTokenExpiresAt' AS "refreshTokenExpiresAt",to_jsonb(s)->>'refreshToken' AS "refreshToken" FROM "PublishingAccountBinding" b JOIN "PublishingAccountVersion" v ON v."bindingId"=b.id AND v.version=$2 JOIN "SocialConnection" s ON s.id=v."connectionId" WHERE b.id=$1`,[target.accountBindingId,target.accountVersion])).rows[0];
  if(!row||row.currentVersion!==target.accountVersion||row.state!=='CONNECTED'||row.status!=='CONNECTED'||row.providerAccountId!==target.providerAccountId||row.connectionId!==target.connectionId)throw Error('TOKEN_REFRESH_DESTINATION_FENCED');return row;
 });}
 async function refresh(target:PublicationTarget){
  // TikTok rotates refresh tokens immediately. All calendars for one provider
  // account must share a reservation, and read credentials only after acquiring it.
  const key=target.platform==='TIKTOK'?'refresh:TIKTOK:'+target.providerAccountId:'refresh:'+target.accountBindingId;
  const token=await deps.coordination.reserveRefresh(key);
  const original=await bound(target);
  if(target.platform==='TIKTOK'){
   if(original.accessTokenExpiresAt&&new Date(original.accessTokenExpiresAt).getTime()>Date.now()+60000){
    await deps.database.transaction(tx=>tx.query(`DELETE FROM "PublishingCoordinationLease" WHERE key=$1 AND token=$2`,[key,token]));
    return {operationId:randomUUID(),maySend:false};
   }
   if(!original.refreshToken||original.refreshTokenExpiresAt&&new Date(original.refreshTokenExpiresAt).getTime()<=Date.now())throw Error('TikTok connection expired. Reconnect TikTok in Channels.');
  }
  const refreshed=await deps.refresh({platform:target.platform,connectionId:target.connectionId,accountId:target.providerAccountId,refreshToken:original.refreshToken});
  if(refreshed.accountId!==target.providerAccountId||!refreshed.accessToken||!(refreshed.expiresAt instanceof Date)||refreshed.expiresAt<=new Date())throw Error('TOKEN_REFRESH_RESPONSE_INVALID');
  if(refreshed.refreshToken!==undefined&&(!refreshed.refreshToken||typeof refreshed.refreshToken!=='string')||refreshed.refreshTokenExpiresAt!==undefined&&(!(refreshed.refreshTokenExpiresAt instanceof Date)||refreshed.refreshTokenExpiresAt<=new Date()))throw Error('TOKEN_REFRESH_ROTATION_INVALID');
  if(target.platform==='TIKTOK'&&(!refreshed.refreshToken||!refreshed.refreshTokenExpiresAt))throw Error('TOKEN_REFRESH_ROTATION_INVALID');
  await deps.database.transaction(async tx=>{
   await deps.validation.lockForPolicyChange(tx);
   const lease=(await tx.query(`SELECT *,"leaseUntil">clock_timestamp() AS live FROM "PublishingCoordinationLease" WHERE key=$1 FOR UPDATE`,[key])).rows[0];if(!lease?.live||lease.token!==token)throw Error('TOKEN_REFRESH_LEASE_FENCED');
   const b=(await tx.query(`SELECT * FROM "PublishingAccountBinding" WHERE id=$1 FOR SHARE`,[target.accountBindingId])).rows[0];if(b.currentVersion!==target.accountVersion||b.state!=='CONNECTED')throw Error('TOKEN_REFRESH_DESTINATION_FENCED');
   const updated=(await tx.query(`UPDATE "SocialConnection" s SET "accessToken"=$2,"accessTokenExpiresAt"=$3,"tokenScopes"=$4 WHERE id=$1 AND "platformAccountId"=$5 AND status='CONNECTED' AND (to_jsonb(s)->>'refreshToken') IS NOT DISTINCT FROM $6 RETURNING id`,[target.connectionId,refreshed.accessToken,refreshed.expiresAt,refreshed.scopes,target.providerAccountId,original.refreshToken])).rows;if(!updated.length)throw Error('TOKEN_REFRESH_DESTINATION_FENCED');
   if(refreshed.refreshToken!==undefined)await tx.query(`UPDATE "SocialConnection" SET "refreshToken"=$2 WHERE id=$1`,[target.connectionId,refreshed.refreshToken]);
   if(refreshed.refreshTokenExpiresAt!==undefined)await tx.query(`UPDATE "SocialConnection" SET "refreshTokenExpiresAt"=$2 WHERE id=$1`,[target.connectionId,refreshed.refreshTokenExpiresAt]);
   if(target.platform==='TIKTOK'){
    // A grant can be shared by multiple workspaces. Rotate every copy of that
    // exact grant in the same commit; leave independently reauthorized grants alone.
    await tx.query(`UPDATE "SocialConnection" SET "accessToken"=$2,"accessTokenExpiresAt"=$3,"refreshToken"=$4,"refreshTokenExpiresAt"=$5,"tokenScopes"=$6 WHERE platform='TIKTOK' AND "platformAccountId"=$1 AND status='CONNECTED' AND "refreshToken"=$7`,[target.providerAccountId,refreshed.accessToken,refreshed.expiresAt,refreshed.refreshToken,refreshed.refreshTokenExpiresAt,refreshed.scopes,original.refreshToken]);
    await tx.query(`UPDATE "SocialCalendar" SET "tikTokAccessToken"=$2,"tikTokAccessTokenExpiresAt"=$3,"tikTokRefreshToken"=$4 WHERE "tikTokOpenId"=$1 AND "tikTokRefreshToken"=$5`,[target.providerAccountId,refreshed.accessToken,refreshed.expiresAt,refreshed.refreshToken,original.refreshToken]);
   }
   // Scope changes are invalidated by C2. They never silently change an old intent's version.
   await tx.query(`DELETE FROM "PublishingCoordinationLease" WHERE key=$1 AND token=$2`,[key,token]);
  });return {operationId:randomUUID(),maySend:false};
 }
 return {refresh};
}
