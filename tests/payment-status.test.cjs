const {test}=require('node:test');const assert=require('node:assert/strict');
test('Месяц с фактической оплаты: границы напоминаний, просрочки и конец месяца',async()=>{
 const {nextPaymentDate,paymentStatus}=await import('../site/scripts/admin/payment-status.js');
 assert.equal(nextPaymentDate('2026-11-15'),'2026-12-15');
 assert.equal(nextPaymentDate('2026-12-20'),'2027-01-20');
 assert.equal(nextPaymentDate('2026-01-31'),'2026-02-28');
 assert.equal(nextPaymentDate('2028-01-31'),'2028-02-29');
 assert.equal(nextPaymentDate('2026-02-30'),null);
 const student={id:'s',start:'2026-11-15',status:'active'};
 const payments=[{student:'s',received:'2026-11-15',amount:300000}];
 for(const [day,kind] of [['2026-12-11','green'],['2026-12-12','yellow'],['2026-12-15','yellow'],['2026-12-17','yellow'],['2026-12-18','red']])assert.equal(paymentStatus(student,payments,day).kind,kind,day);
 const renewed=[...payments,{student:'s',received:'2026-12-20'}];
 assert.deepEqual(paymentStatus(student,renewed,'2026-12-20'),{kind:'green',text:'Оплачено',due:'2027-01-20'});
 assert.equal(paymentStatus(student,[...payments,{student:'s',received:'2026-12-20',deletedAt:'2026-12-21'}],'2026-12-21').kind,'red');
 assert.equal(paymentStatus(student,renewed,'2026-12-18').kind,'red','Future receipt must not hide debt');
 assert.equal(paymentStatus(student,[],'2026-11-18').kind,'red');
 assert.equal(paymentStatus({...student,status:'finished'},payments,'2026-12-18').kind,'quiet');
});
