import { addSlots, checkProjectLimit, checkNodeLimit } from './plans.js';

// Test entitlement only. A production release must replace self-service test
// grants and quota locks with server-verified Play Billing and server quotas.
export function cloudPlans({ fs, db, auth, native }) {
 const planRef = uid => fs.doc(db, 'testSlots', uid);
 const projectRef = pid => fs.doc(db, 'projects', pid);
 const snapshotData = snap => snap.exists() ? snap.data() : null;
 function requireNative() { if (!native()) throw Error('슬롯 구매은 안드로이드 앱에서 이용해 주세요.'); }
 return {
  watchSlots(uid, cb, error) { return fs.onSnapshot(planRef(uid), snap => cb(snapshotData(snap)), error); },
  async purchaseTestSlots(id) {
   requireNative();if(!auth.currentUser)throw Error('로그인해 주세요.');
   await fs.runTransaction(db,async tx=>{const ref=planRef(auth.currentUser.uid),snap=await tx.get(ref);tx.set(ref,{...addSlots(snapshotData(snap),id),updatedAt:fs.serverTimestamp()})});
  },
  async createProject(name, uid) {
   if(uid!==auth.currentUser.uid)throw Error('로그인 계정을 확인해 주세요.');
   const ref=fs.doc(fs.collection(db,'projects'));
   await fs.runTransaction(db, async tx => {
    const lock=fs.doc(db,'quotaLocks',uid), revision=await tx.get(lock), plan=await tx.get(planRef(uid));
    // Read inside the retry callback after acquiring the common revision. If a
    // competing create commits, Firestore retries and recounts existing data.
    const projects=await fs.getDocsFromServer(fs.query(fs.collection(db,'projects'),fs.where('owner','==',uid)));
    checkProjectLimit(projects.size,snapshotData(plan));
    tx.set(lock,{revision:(revision.exists()?revision.data().revision:0)+1});
    tx.set(ref,{name,owner:uid,members:[uid],inviteCode:'',createdAt:fs.serverTimestamp()});
   });
  },
  async saveNode(pid,id,fields,isNew) {
   const node=fs.doc(db,'projects',pid,'nodes',id);
   if(!isNew)return fs.updateDoc(node,{...fields,updatedAt:fs.serverTimestamp()});
   await fs.runTransaction(db,async tx=>{
    const project=await tx.get(projectRef(pid));
    if(!project.exists()||project.data().deleting)throw Error('사용할 수 없는 프로젝트입니다.');
    const lock=fs.doc(db,'projects',pid,'quotaLocks','nodes'), revision=await tx.get(lock);
    const plan=await tx.get(planRef(project.data().owner)), existing=await tx.get(node);
    if(existing.exists())throw Error('이미 저장된 개념입니다. 다시 열어 확인해 주세요.');
    const nodes=await fs.getDocsFromServer(fs.collection(db,'projects',pid,'nodes'));
    checkNodeLimit(nodes.size,snapshotData(plan));
    tx.set(lock,{revision:(revision.exists()?revision.data().revision:0)+1});
    tx.set(node,{...fields,updatedAt:fs.serverTimestamp()});
   });
  },
 };
}
