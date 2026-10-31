import { cloudPlans } from './cloud-plans.js';
import { planState, monthAfter, checkProjectLimit, checkNodeLimit } from './plans.js';
import { loginEmail, DEVELOPER_EMAIL } from './messages.js';
import { normalizeProfile } from './profile.js';
const sample=[['개념 지도',0,0,190,'#e4edd9',['학습','아이디어'],'개념 사이의 연결을 시각적으로 표현하는 지도입니다.\n\n생각을 작은 단위로 나누고, 공통된 해시태그로 다시 연결해보세요.'],['디자인 씽킹',-270,-120,150,'#f3f6ed',['아이디어','디자인'],'사람의 필요에서 출발해 문제를 정의하고 해결책을 반복해서 검증하는 방법.'],['창의적 사고',240,-150,150,'#f4e8d8',['아이디어'],'기존의 생각을 새로운 방식으로 연결해보세요.'],['지식의 연결',290,110,165,'#e4edf1',['학습','아이디어'],'하나의 개념을 이해하는 데서 나아가 개념 사이의 관계를 발견합니다.'],['기록의 습관',-250,150,140,'#eee7f2',['학습','기록'],'짧은 생각이라도 기록하면 다음 생각의 출발점이 됩니다.'],['작은 발견',60,250,115,'#f3f6ed',['기록'],'오늘 새롭게 알게 된 것을 한 문장으로 남겨보세요.']];
export async function createStore(demo=false){
 if(demo||!window.CIRCLE_FIREBASE_CONFIG){
  const key='circle-demo-v1';let data;try{data=JSON.parse(localStorage.getItem(key))}catch{}if(!data){data={projects:[{id:'welcome',name:'DEMO',owner:'demo',members:['demo']}],nodes:{welcome:sample.map(([name,x,y,size,color,tags,memo],i)=>({id:'seed'+i,name,x,y,size,color,tags,memo}))}}}data.profiles ||= {};data.plans ||= {};let planListener=null;let projectListener=null,nodeListener=null,active=null,profileListener=null,presenceListener=null;const sessions=new Map();
  const save=()=>{localStorage.setItem(key,JSON.stringify(data));projectListener?.(structuredClone(data.projects));if(active)nodeListener?.(structuredClone(data.nodes[active]||[]))};
  return {cloud:false,
 watchPlan(uid,cb){planListener=()=>cb(data.plans[uid]||null);queueMicrotask(()=>planListener?.());return()=>{planListener=null}},
 async activateTestPlan(){if(!window.CircleNative?.isNative)throw Error('circle+ 신청은 안드로이드 앱에서 이용해 주세요.');if(planState(data.plans.demo).active)return;const startedAt=Date.now();data.plans.demo={mode:'test',startedAt,expiresAt:monthAfter(startedAt),autoRenew:true};save();planListener?.()},
 async cancelTestRenewal(){if(!window.CircleNative?.isNative)throw Error('구독 관리는 안드로이드 앱에서 이용해 주세요.');if(data.plans.demo){data.plans.demo.expiresAt=planState(data.plans.demo).renewsAt;data.plans.demo.autoRenew=false;save();planListener?.()}},
 async renameProject(id,name,uid){const p=data.projects.find(p=>p.id===id);if(!p||p.owner!==uid)throw Error('소유자만 수정할 수 있습니다.');if(!name||name.length>60)throw Error('프로젝트 이름은 1~60자로 입력하세요.');p.name=name;save()},
 async deleteProject(id,uid){const p=data.projects.find(p=>p.id===id);if(!p||p.owner!==uid)throw Error('소유자만 삭제할 수 있습니다.');data.projects=data.projects.filter(p=>p.id!==id);delete data.nodes[id];save()},
 watchProfile(uid,cb){profileListener=cb;queueMicrotask(()=>{if(profileListener===cb)cb(data.profiles[uid]||null)});return()=>{if(profileListener===cb)profileListener=null}},
 async saveProfile(uid,profile){data.profiles[uid]=normalizeProfile(profile);localStorage.setItem(key,JSON.stringify(data));profileListener?.(structuredClone(data.profiles[uid]))},
 watchPresence(pid,cb){presenceListener=cb;queueMicrotask(()=>{if(presenceListener===cb)cb([...sessions.values()])});return()=>{if(presenceListener===cb)presenceListener=null}},
 async heartbeatPresence(pid,id,profile){sessions.set(id,{...profile,lastSeen:Date.now()});presenceListener?.([...sessions.values()])},
 async leavePresence(pid,id){sessions.delete(id);presenceListener?.([...sessions.values()])},
 watchProjects(uid,cb){projectListener=cb;queueMicrotask(()=>cb(structuredClone(data.projects)));return()=>{projectListener=null}},watchNodes(id,cb){active=id;nodeListener=cb;queueMicrotask(()=>cb(structuredClone(data.nodes[id]||[])));return()=>{nodeListener=null;active=null}},async createProject(name,uid){checkProjectLimit(data.projects.filter(p=>p.owner===uid).length,data.plans[uid]);const id=crypto.randomUUID();data.projects.push({id,name,owner:uid,members:[uid]});data.nodes[id]=[];save()},async saveNode(pid,id,fields,isNew){const list=data.nodes[pid]||=[];if(isNew){checkNodeLimit(list.length,data.plans[data.projects.find(p=>p.id===pid)?.owner]);list.push({id,...fields})}else{const n=list.find(n=>n.id===id);if(!n)throw Error('삭제된 개념입니다.');Object.assign(n,fields)}save()},async moveNode(pid,id,x,y){const n=data.nodes[pid].find(n=>n.id===id);if(n){Object.assign(n,{x,y});save()}},async deleteNode(pid,id){data.nodes[pid]=data.nodes[pid].filter(n=>n.id!==id);save()}};
 }
 const {core,auth,fs}=window.CircleFirebaseSDK||await (async()=>{const [core,auth,fs]=await Promise.all([import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js')]);return {core,auth,fs}})();
 const app=core.initializeApp(window.CIRCLE_FIREBASE_CONFIG),a=window.CircleNative?.isNative?auth.initializeAuth(app,{persistence:auth.indexedDBLocalPersistence}):auth.getAuth(app),db=fs.getFirestore(app),projectRef=id=>fs.doc(db,'projects',id),nodeRef=(pid,id)=>fs.doc(db,'projects',pid,'nodes',id);
 return {cloud:true,
 ...cloudPlans({fs,db,auth:a,native:()=>!!window.CircleNative?.isNative}),
 async isDeveloper(){if(!a.currentUser)return false;const access=await fs.getDoc(fs.doc(db,'developerAccess',a.currentUser.uid));return access.exists()&&access.data().enabled===true},
 async sendFeedback(message,context){
  if(!a.currentUser)throw Error('로그인 후 이슈를 전송할 수 있습니다.');
  message=String(message||'').trim();if(!message||message.length>4000)throw Error('내용을 1~4000자로 입력해 주세요.');
  await fs.addDoc(fs.collection(db,'feedback'),{uid:a.currentUser.uid,message,nickname:normalizeProfile(context).nickname,platform:context.platform==='android'?'android':'web',projectName:String(context.projectName||'').slice(0,60),createdAt:fs.serverTimestamp()});
 },
 watchFeedback(cb,error){return fs.onSnapshot(fs.query(fs.collection(db,'feedback'),fs.orderBy('createdAt','desc')),snapshot=>cb(snapshot.docs.map(doc=>({id:doc.id,...doc.data()}))),error)},

 async renameProject(id,name){if(!name||name.length>60)throw Error('프로젝트 이름은 1~60자로 입력하세요.');await fs.runTransaction(db,async tx=>{const snap=await tx.get(projectRef(id));if(!snap.exists()||snap.data().owner!==a.currentUser.uid)throw Error('소유자만 수정할 수 있습니다.');if(snap.data().deleting)throw Error('삭제 중인 프로젝트입니다.');tx.update(projectRef(id),{name})})},
 async deleteProject(id){
  // Lock writes and revoke the invitation before draining subcollections.
  const exists=await fs.runTransaction(db,async tx=>{
   const snap=await tx.get(projectRef(id));if(!snap.exists())return false;
   if(snap.data().owner!==a.currentUser.uid)throw Error('소유자만 삭제할 수 있습니다.');
   if(snap.data().inviteCode)tx.delete(fs.doc(db,'invites',snap.data().inviteCode));
   tx.update(projectRef(id),{deleting:true,inviteCode:''});return true;
  });
  if(!exists)return;
  for(const collection of ['nodes','presence','quotaLocks']){
   while(true){const snapshot=await fs.getDocs(fs.query(fs.collection(db,'projects',id,collection),fs.limit(100)));if(snapshot.empty)break;
    const batch=fs.writeBatch(db);snapshot.docs.forEach(doc=>batch.delete(doc.ref));await batch.commit();
   }
  }
  await fs.deleteDoc(projectRef(id));
 },
 watchProfile(uid,cb,error){return fs.onSnapshot(fs.doc(db,'users',uid),s=>cb(s.exists()?s.data():null),error)},
 saveProfile(uid,profile){if(uid!==a.currentUser?.uid)throw Error('본인의 프로필만 수정할 수 있습니다.');return fs.setDoc(fs.doc(db,'users',uid),{...normalizeProfile(profile),updatedAt:fs.serverTimestamp()})},
 watchPresence(pid,cb,error){return fs.onSnapshot(fs.collection(db,'projects',pid,'presence'),{includeMetadataChanges:true},s=>cb(s.docs.map(d=>({...d.data(),id:d.id})),s.metadata.fromCache),error)},
 heartbeatPresence(pid,id,profile){return fs.setDoc(fs.doc(db,'projects',pid,'presence',id),{uid:a.currentUser.uid,...normalizeProfile(profile),lastSeen:fs.serverTimestamp()})},
 leavePresence(pid,id){return fs.deleteDoc(fs.doc(db,'projects',pid,'presence',id))},
 onAuth:cb=>auth.onAuthStateChanged(a,cb),login:(email,password)=>auth.signInWithEmailAndPassword(a,loginEmail(email),password),signup:(email,password)=>{if(loginEmail(email).toLowerCase()===DEVELOPER_EMAIL)throw Error('이 아이디는 회원가입에 사용할 수 없습니다.');return auth.createUserWithEmailAndPassword(a,email.trim(),password)},loginGoogle:async()=>{if(window.CircleNative?.isNative){const result=await window.CircleNative.signInWithGoogle();const idToken=result.credential?.idToken;if(!idToken)throw new Error('Google 인증 토큰을 받지 못했습니다. Android Firebase 설정을 확인하세요.');return auth.signInWithCredential(a,auth.GoogleAuthProvider.credential(idToken))}const provider=new auth.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});return auth.signInWithPopup(a,provider)},logout:async()=>{await auth.signOut(a);if(window.CircleNative?.isNative)try{await window.CircleNative.signOut?.()}catch(error){console.error(error)}},watchProjects(uid,cb,error){return fs.onSnapshot(fs.query(fs.collection(db,'projects'),fs.where('members','array-contains',uid)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()}))),error)},watchNodes(pid,cb,error){return fs.onSnapshot(fs.collection(db,'projects',pid,'nodes'),s=>cb(s.docs.map(d=>({id:d.id,...d.data()}))),error)},moveNode(pid,id,x,y){return fs.updateDoc(nodeRef(pid,id),{x,y,updatedAt:fs.serverTimestamp()})},deleteNode(pid,id){return fs.deleteDoc(nodeRef(pid,id))},async invite(p){const code=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');await fs.runTransaction(db,async tx=>{const snap=await tx.get(projectRef(p.id));const old=snap.data().inviteCode;if(old)tx.delete(fs.doc(db,'invites',old));tx.set(fs.doc(db,'invites',code),{projectId:p.id,owner:a.currentUser.uid});tx.update(projectRef(p.id),{inviteCode:code})});return code},async join(code){if(!/^[a-f0-9]{32}$/.test(code))throw Error('올바른 초대 코드를 입력하세요.');const uid=a.currentUser.uid;await fs.runTransaction(db,async tx=>{const invite=await tx.get(fs.doc(db,'invites',code));if(!invite.exists())throw Error('코드가 없거나 만료되었습니다.');const pid=invite.data().projectId;tx.update(projectRef(pid),{members:fs.arrayUnion(uid),joinCode:code})})}};
}

