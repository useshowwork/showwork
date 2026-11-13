type LeadRecord={
  id:string;name:string;username:string|null;email:string|null;phone:string|null;company:string|null;
  temperature:string;status:string;source:string;createdAt:Date|string;updatedAt:Date|string;
  socialConversation:{platform:string;participantName:string|null;participantUsername:string|null}|null;
};
/** Explicit projection: never share notes, message history, provider IDs or tracking records. */
export function clientLeadRecord(lead:LeadRecord) {
  const conversation=lead.socialConversation;
  const username=lead.username || conversation?.participantUsername || null;
  const generic=["social contact","facebook contact","facebook user","instagram contact","instagram account","instagram user"];
  const name=generic.includes(lead.name.trim().toLowerCase()) ? conversation?.participantName || username || lead.name : lead.name;
  return {id:lead.id,name,username,email:lead.email,phone:lead.phone,company:lead.company,
    temperature:lead.temperature,status:lead.status,source:lead.source,
    createdAt:lead.createdAt,updatedAt:lead.updatedAt,socialPlatform:conversation?.platform || null,notes:null};
}
