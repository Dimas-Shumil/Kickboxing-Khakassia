// Calendar dates in Abakan; UTC arithmetic avoids DST and local time-zone shifts.
export function nextPaymentDate(received){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(received||''))return null;
 const [y,m,d]=received.split('-').map(Number);
 const source=new Date(Date.UTC(y,m-1,d));
 if(source.toISOString().slice(0,10)!==received)return null;
 const days=new Date(Date.UTC(y,m+1,0)).getUTCDate();
 return new Date(Date.UTC(y,m,Math.min(d,days))).toISOString().slice(0,10);
}
export function paymentStatus(student,payments,today){
 if(student.status!=='active')return {kind:'quiet',text:'Не занимается',due:null};
 const latest=payments.filter(p=>p.student===student.id&&!p.deletedAt&&p.received<=today).sort((a,b)=>b.received.localeCompare(a.received))[0];
 const due=latest?nextPaymentDate(latest.received):student.start;
 if(!due)return {kind:'quiet',text:'Нет даты оплаты',due:null};
 const days=Math.round((Date.parse(due+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
 if(days<=-3)return {kind:'red',text:'Просрочено',due};
 if(days<=3)return {kind:'yellow',text:days<0?'Ожидается оплата':days===0?'Оплата сегодня':'Скоро оплата',due};
 return {kind:latest?'green':'quiet',text:latest?'Оплачено':'Ожидается первая оплата',due};
}
