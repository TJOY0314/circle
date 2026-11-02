import {slotState} from './plans.js';
const offlineError=()=>Error('온라인 프로젝트는 인터넷에 연결되어 있을 때만 열거나 수정할 수 있습니다.');
export function withOffline(remote,{user,online=()=>navigator.onLine!==false,storage=globalThis.localStorage,events=window}){
 const uploads=new Set();
 let projectListener=null,nodeListener=null,activeId=null,unremote=()=>{},remoteProjects=[],limits=null;
 const uid=()=>user()?.uid;
 const key=()=> 'circle-offline-v1-'+uid();
 const read=()=>{try{const raw=storage.getItem(key());const value=raw?JSON.parse(raw):null;return value&&Array.isArray(value.projects)?value:{projects:[],nodes:{}}}catch{throw Error('기기에 저장된 오프라인 데이터를 읽지 못했습니다. 데이터를 지우지 말고 개발자에게 문의해 주세요.')}};
 const localId=id=>typeof id==='string'&&id.startsWith('local-');
 function emit(){const data=read();projectListener?.([...remoteProjects.map(p=>({...p,offline:false})),...data.projects]);if(activeId&&localId(activeId))nodeListener?.(structuredClone(data.nodes[activeId]||[]))}
 function save(data){try{storage.setItem(key(),JSON.stringify(data))}catch{throw Error('기기 저장 공간이 부족해 저장하지 못했습니다. 공간을 확보한 뒤 다시 저장해 주세요.')}emit()}
 const projectOf=(data,id)=>{const p=data.projects.find(p=>p.id===id);if(!p)throw Error('오프라인 프로젝트가 없습니다.');if(uploads.has(id))throw Error('온라인 전환 중에는 편집할 수 없습니다.');return p};
 function connect(){unremote();unremote=()=>{};if(!uid())return;if(online()){unremote=remote.watchProjects(uid(),items=>{remoteProjects=items.filter(p=>!p.importing);try{storage.setItem('circle-project-metadata-'+uid(),JSON.stringify(remoteProjects))}catch{}emit()},error=>{projectListener?.(read().projects);console.error(error)})}else{try{remoteProjects=JSON.parse(storage.getItem('circle-project-metadata-'+uid()))||[]}catch{remoteProjects=[]}emit()}}
 const ensureOnline=()=>{if(!online())throw offlineError()};
 const localWrite=fn=>{const data=read();fn(data);save(data)};
 return {...remote,
 isOfflineProject:localId,
 watchProfile(id,cb,error){if(!online()){let profile=null;try{profile=JSON.parse(storage.getItem('circle-profile-'+id))}catch{}queueMicrotask(()=>cb(profile));return()=>{}}return remote.watchProfile(id,value=>{try{storage.setItem('circle-profile-'+id,JSON.stringify(value))}catch{}cb(value)},error)},
 watchSlots(id,cb,error){try{limits=JSON.parse(storage.getItem('circle-limits-'+id))}catch{}if(limits)queueMicrotask(()=>cb(limits));return remote.watchSlots(id,value=>{limits=value;try{storage.setItem('circle-limits-'+id,JSON.stringify(value))}catch{}cb(value)},error)},
 watchProjects(id,cb,error){projectListener=cb;connect();events.addEventListener('online',connect);events.addEventListener('offline',connect);return()=>{unremote();projectListener=null;events.removeEventListener('online',connect);events.removeEventListener('offline',connect)}},
 watchNodes(id,cb,error){if(localId(id)){activeId=id;nodeListener=cb;cb(structuredClone(read().nodes[id]||[]));return()=>{activeId=null;nodeListener=null}}ensureOnline();return remote.watchNodes(id,rows=>{if(online())cb(rows);else error?.(offlineError())},error)},
 async createProject(name,id,offline=false){if(!offline&&online()){ensureOnline();return remote.createProject(name,id)}if(id!==uid())throw Error('로그인 계정을 확인해 주세요.');const data=read();if(data.projects.length+remoteProjects.filter(p=>p.owner===id).length>=slotState(limits).projects)throw Error('프로젝트 생성 한도에 도달했습니다.');const pid='local-'+crypto.randomUUID();data.projects.push({id:pid,name,owner:id,members:[id],offline:true,createdAt:Date.now()});data.nodes[pid]=[];save(data);return {id:pid}},
 async saveNode(pid,id,fields,isNew){if(!localId(pid)){ensureOnline();return remote.saveNode(pid,id,fields,isNew)}localWrite(data=>{projectOf(data,pid);const rows=data.nodes[pid]||=[];if(isNew){if(rows.length>=slotState(limits).concepts)throw Error('개념어 생성 한도에 도달했습니다.');if(rows.some(n=>n.id===id))throw Error('이미 저장된 개념어입니다.');rows.push({id,...fields})}else{const node=rows.find(n=>n.id===id);if(!node)throw Error('개념어가 없습니다.');Object.assign(node,fields)}})},
 async moveNode(pid,id,x,y){if(!localId(pid)){ensureOnline();return remote.moveNode(pid,id,x,y)}localWrite(data=>{projectOf(data,pid);const node=data.nodes[pid].find(n=>n.id===id);if(node)Object.assign(node,{x,y})})},
 async deleteNode(pid,id){if(!localId(pid)){ensureOnline();return remote.deleteNode(pid,id)}localWrite(data=>{projectOf(data,pid);data.nodes[pid]=data.nodes[pid].filter(n=>n.id!==id)})},
 async renameProject(pid,name,id){if(!localId(pid)){ensureOnline();return remote.renameProject(pid,name,id)}if(!name||name.length>60)throw Error('이름을 1~60자로 입력해 주세요.');localWrite(data=>{projectOf(data,pid).name=name})},
 async deleteProject(pid,id){if(!localId(pid)){ensureOnline();return remote.deleteProject(pid,id)}localWrite(data=>{projectOf(data,pid);data.projects=data.projects.filter(p=>p.id!==pid);delete data.nodes[pid]})},
 async convertOfflineProject(pid){ensureOnline();let data=read(),p=projectOf(data,pid);uploads.add(pid);try{const result=await remote.importOfflineProject({localId:pid,name:p.name,nodes:data.nodes[pid]||[]});data=read();data.projects=data.projects.filter(p=>p.id!==pid);delete data.nodes[pid];save(data);return result}catch(error){data=read();const item=data.projects.find(p=>p.id===pid);if(item)emit();throw error}finally{uploads.delete(pid)}},
 clearOfflineData(id=uid()){for(const prefix of ['circle-offline-v1-','circle-project-metadata-','circle-limits-','circle-profile-','circle-visits-','circle-pending-rewards-','circle-client-rewards-'])storage.removeItem(prefix+id)},
 async heartbeatPresence(pid,...args){if(localId(pid))return;ensureOnline();return remote.heartbeatPresence(pid,...args)},
 watchPresence(pid,cb,error){if(localId(pid)){cb([]);return()=>{}}ensureOnline();return remote.watchPresence(pid,cb,error)},
 async leavePresence(pid,...args){if(localId(pid)||!online())return;return remote.leavePresence(pid,...args)},
 async invite(p){ensureOnline();if(localId(p.id))throw Error('오프라인 프로젝트를 먼저 온라인으로 전환해 주세요.');return remote.invite(p)},
 async join(code){ensureOnline();return remote.join(code)}
 };
}
