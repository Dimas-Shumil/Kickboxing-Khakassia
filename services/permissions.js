export const canPublish = user => ['OWNER','TRAINER'].includes(user?.role);
export const canGym = user => ['OWNER','TRAINER'].includes(user?.role);
