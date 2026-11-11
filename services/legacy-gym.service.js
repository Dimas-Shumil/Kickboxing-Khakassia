// Administrative operation only: caller must authenticate OWNER and explicitly choose a target.
export async function assignLegacy(db,gymId,actorId){
 return db.$transaction(async tx=>{
  if(!await tx.gym.findUnique({where:{id:gymId}}))throw new Error('Зал не найден.');
  // Do not silently merge identical group names or split connected attendance records.
  const groups=await tx.trainingGroup.findMany();
  const old=groups.filter(g=>g.gymId===null),target=groups.filter(g=>g.gymId===gymId);
  if(old.some(g=>target.some(t=>t.name.toLocaleLowerCase('ru')===g.name.toLocaleLowerCase('ru'))))throw new Error('В целевом зале уже есть группа с таким названием. Нужен индивидуальный перенос.');
  const sessions=await tx.gymSession.findMany({include:{group:true,attendance:{include:{student:true}}}});
  for(const s of sessions){
   const effective=s.gymId??gymId;
   if(s.group&&(s.group.gymId??gymId)!==effective||s.attendance.some(a=>(a.student.gymId??gymId)!==effective))throw new Error('Обнаружены связи между разными залами. Нужен индивидуальный перенос.');
  }
  // Capture entity identities before updating; historical log ownership follows entities.
  for(const [model,scopes] of [['student',['students']],['trainingGroup',['gym-groups']],['gymSession',['gym-sessions','gym-attendance']],['financeEntry',['gym-finances']]]){
   const rows=await tx[model].findMany({where:{gymId:null},select:{id:true}});
   if(rows.length)await tx.auditLog.updateMany({where:{scope:{in:scopes},entityId:{in:rows.map(r=>r.id)},gymId:null},data:{gymId}});
  }
  const payments=await tx.payment.findMany({where:{pupil:{gymId:null}},select:{id:true}});
  if(payments.length)await tx.auditLog.updateMany({where:{scope:'payments',entityId:{in:payments.map(p=>p.id)},gymId:null},data:{gymId}});
  for(const model of ['student','trainingGroup','gymSession','financeEntry'])await tx[model].updateMany({where:{gymId:null},data:{gymId}});
  // Account-management event remains owner-only (not in the common content scopes).
  await tx.auditLog.create({data:{actorId,scope:'access',entityId:gymId,action:'assign-legacy'}});
 },{timeout:60000});
}
