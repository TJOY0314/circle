import { slotState, PRODUCTS } from './plans.js';
import { friendlyError, DEVELOPER_EMAIL } from './messages.js';
import { createStore } from './store.js';
import { normalizeProfile, createPresenceSession } from './profile.js';
import { safeColor, toRGB, fromRGB, textColor } from './color.js';
const $=s=>document.querySelector(s), app=$('#app'), modal=$('#modal');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let store,user,projects=[],project,nodes=[],unsubscribe=()=>{},unprojects=()=>{},selected=null,filter='',camera={x:0,y:0,z:1},toastTimer,editorDraft=null;
let subscription=null,unplan=()=>{},planTimer=null;
let developerMode=false,unfeedback=()=>{},uninquiries=()=>{},authGeneration=0;
let profile=normalizeProfile(null),unprofile=()=>{},presence=null,participants=[],presenceState='connecting',nativeForeground=true,editorSaving=false;
const native=()=>!!window.CircleNative?.isNative;
const compact=()=>window.matchMedia('(max-width: 880px)').matches;
let sidebarOpen;try{const saved=localStorage.getItem('circle-sidebar-open');sidebarOpen=saved===null?!compact():saved==='true'}catch{sidebarOpen=!compact()}
const colors=['#f3f6ed','#e4edd9','#e4edf1','#f4e8d8','#eee7f2','#f5e3e1'];
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3300)}
async function attempt(fn){try{return await fn()}catch(e){toast(friendlyError(e));console.error(e)}}
function dialog(title,body,action,onSave){modal.setAttribute('aria-label',title);modal.innerHTML=`<form><h2>${esc(title)}</h2>${body}<div class="modal-actions"><button type="button" id="cancel">취소</button><button class="primary">${esc(action)}</button></div></form>`;$('#cancel').onclick=()=>modal.close();modal.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=e.submitter||modal.querySelector('button.primary');b.disabled=true;try{await onSave(new FormData(e.target));modal.close()}catch(err){toast(friendlyError(err))}finally{b.disabled=false}};modal.showModal()}
function logo(){return '<div class="logo"><img class="brand-icon" src="circleIcon.png" alt="" width="32" height="32">circle<span style="color:#9aaa90">.</span></div>'}
function login(){stopPlan();user=null;developerMode=false;unfeedback();uninquiries();unsubscribe();unprojects();unprofile();stopProjectPresence();project=null;app.innerHTML=`<main class="login"><div class="login-issue">${planControl()}<button type="button" id="login-issue" class="icon-button issue-button" aria-label="이슈 전송" title="이슈 전송">!</button></div><section class="intro">${logo()}<div class="eyebrow" style="margin-top:90px">A LITTLE SPACE FOR BIG IDEAS</div><h1 style="margin-top:22px">흩어진 생각이,<br>하나의 지도가 되는 곳.</h1><p>개념을 담고, 생각을 정리하고, 새로운 연결을 발견하세요.<br>당신의 지식이 자라는 작은 공간, Circle.</p><div class="orbit"><div class="orb a">기록하다</div><div class="orb b">연결하다</div><div class="orb c">발견하다</div></div><div class="eyebrow">YOUR THOUGHTS, CONNECTED.</div></section><section class="login-form"><div class="mobile-login-brand">${logo()}</div><div class="eyebrow">WELCOME TO CIRCLE</div><h2>생각의 공간에 들어오세요</h2><p class="muted">로그인하고 나만의 개념 지도를 이어가세요.</p><form id="authform"><label for="email">이메일</label><input id="email" type="text" inputmode="email" placeholder="이메일 또는 로그인 아이디" required autocomplete="username" autocapitalize="none" spellcheck="false"><label for="password">비밀번호</label><div class="password-field"><input id="password" type="password" placeholder="6자 이상 입력해 주세요" minlength="6" required autocomplete="current-password"><button type="button" id="togglepassword" aria-controls="password" aria-pressed="false" aria-label="비밀번호 표시">표시</button></div><button id="login-submit" type="submit" class="primary" ${store.cloud?'':'disabled'}>로그인 →</button></form><button id="signup" class="quiet" ${store.cloud?'':'disabled'}>처음이신가요? 계정 만들기</button><button type="button" id="account-help" class="quiet">계정이 기억나지 않으신가요?</button><div class="divider">또는</div><button type="button" id="googlelogin" class="google-login" ${store.cloud?'':'disabled'}><span aria-hidden="true" class="google-g">G</span> Google 계정으로 로그인</button><button id="demo">체험 공간 둘러보기 ↗</button>${store.cloud?'':'<div class="notice">현재 체험 모드로 이용할 수 있어요. 계정 로그인과 팀 공유는 Firebase 연결 후 사용할 수 있습니다.</div>'}</section></main>`;$('#login-issue').disabled=true;$('#account-help').onclick=accountInquiry;bindPlanControl();$('#togglepassword').onclick=()=>{const field=$('#password'),button=$('#togglepassword');const show=field.type==='password';field.type=show?'text':'password';button.textContent=show?'숨기기':'표시';button.setAttribute('aria-pressed',String(show));button.setAttribute('aria-label',show?'비밀번호 숨기기':'비밀번호 표시')};$('#googlelogin').onclick=async()=>{const button=$('#googlelogin');button.disabled=true;try{await store.loginGoogle()}catch(error){toast(friendlyError(error));}finally{button.disabled=false}};$('#authform').onsubmit=e=>{e.preventDefault();submitLogin()};$('#signup').onclick=()=>{if($('#authform').reportValidity())attempt(async()=>{const button=$('#signup');button.disabled=true;try{await store.signup($('#email').value,$('#password').value)}finally{button.disabled=false}})};$('#demo').onclick=async()=>{authGeneration++;unfeedback();uninquiries();unsubscribe();unprojects();store=await createStore(true);user={uid:'demo',email:'체험 사용자'};start()}}
async function submitLogin(){
 const button=$('#login-submit');button.disabled=true;
 try{await store.login($('#email').value,$('#password').value)}catch(error){toast(friendlyError(error))}finally{button.disabled=false}
}
async function handleAuth(nextUser){
 const generation=++authGeneration;user=nextUser;unfeedback();uninquiries();if(developerMode)app.innerHTML='<p style="padding:24px">계정을 확인하는 중입니다.</p>';developerMode=false;
 if(!user){login();return}
 let allowed=false;
 try{allowed=await store.isDeveloper()}catch(error){console.error(error)}
 if(generation!==authGeneration)return;
 if(allowed){developerMode=true;openDeveloper();return}
 if(user.email?.toLowerCase()===DEVELOPER_EMAIL){await store.logout();toast('개발자 접근 권한이 없습니다. 계정 설정을 확인해 주세요.');return}
 start();
}
function sendIssue(){
 if(!store?.cloud||!user)return toast('로그인 후 이슈를 전송할 수 있습니다. 체험 모드에서는 전송되지 않습니다.');
 dialog('개발자에게 이슈 전송','<p>불편한 점이나 개선 의견을 알려주세요. 보낸 내용은 개발자 피드백 목록에 전달됩니다.</p><label for="issue-message">내용</label><textarea id="issue-message" name="message" rows="7" maxlength="4000" required placeholder="어떤 화면에서 무슨 문제가 발생했나요?"></textarea>','전송',async form=>{
  await store.sendFeedback(form.get('message'),{...profile,platform:native()?'android':'web',projectName:project?.name||''});toast('개발자에게 이슈를 전송했습니다.');
 });
}
function openDeveloper(){
 startPlan();unsubscribe();unprojects();unprofile();stopProjectPresence();project=null;
 app.innerHTML=`<main class="developer-screen"><header class="topbar"><div>${logo()}<p class="developer-label">개발자 모드</p></div><div class="topbar-actions">${planControl()}<button id="send-issue" class="icon-button issue-button" aria-label="이슈 전송" title="이슈 전송">!</button><button id="developer-logout">로그아웃</button></div></header><section class="feedback-content"><button id="compose-notice" class="primary">전체 공지 작성</button><h1>계정 찾기 문의</h1><div id="inquiry-list"></div><h1>사용자 피드백</h1><p id="feedback-status" role="status">피드백을 불러오는 중입니다.</p><div id="feedback-list"></div></section></main>`;
 $('#compose-notice').onclick=composeNotice;uninquiries=store.watchAccountInquiries?.(items=>{if(!developerMode||!$('#inquiry-list'))return;$('#inquiry-list').innerHTML=items.length?items.map(item=>'<article class="feedback-card"><strong>'+esc(item.email)+'</strong><time> '+esc(item.createdAt?.toDate?.().toLocaleString('ko-KR')||'전송 중')+'</time><p class="feedback-message">'+esc(item.message)+'</p></article>').join(''):'계정 문의가 없습니다.'},error=>{if($('#inquiry-list'))$('#inquiry-list').textContent=friendlyError(error)})||(()=>{});$('#send-issue').onclick=sendIssue;bindPlanControl();$('#developer-logout').onclick=()=>attempt(()=>store.logout());
 unfeedback();unfeedback=store.watchFeedback(items=>{
  if(!developerMode||!$('#feedback-list'))return;
  $('#feedback-status').textContent=items.length?items.length+'개의 피드백':'아직 도착한 피드백이 없습니다.';
  $('#feedback-list').innerHTML=items.map(item=>{
   const date=item.createdAt?.toDate?.();const when=date?date.toLocaleString('ko-KR'):'전송 중';
   return `<article class="feedback-card"><div class="feedback-meta"><strong>${esc(item.nickname||'사용자')}</strong><span>${item.platform==='android'?'Android':'웹'}</span><time>${esc(when)}</time></div>${item.projectName?'<p class="muted">프로젝트: '+esc(item.projectName)+'</p>':''}<p class="feedback-message">${esc(item.message)}</p></article>`;
  }).join('');
 },error=>{if($('#feedback-list'))$('#feedback-list').innerHTML='';if($('#feedback-status'))$('#feedback-status').textContent=friendlyError(error)});
}
function noticeControl(){return '<button type="button" id="notices-button" class="icon-button" aria-label="공지사항" title="공지사항"><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 9h5l11-5v16L9 15H4zM8 15l2 6H6l-2-6M20 9h2v6h-2"/></svg></button>'}
function planControl(){return '<div class="plan-control"><button type="button" id="plan-button" class="plan-button" aria-label="슬롯 구매 및 현황" title="슬롯 구매 및 현황"><span aria-hidden="true">+</span></button></div>'+noticeControl()}
function refreshPlan(){if($('#plan-button'))$('#plan-button').disabled=!user}
function bindPlanControl(){if($('#plan-button'))$('#plan-button').onclick=showPlan;if($('#notices-button'))$('#notices-button').onclick=showNotices;refreshPlan()}
function stopPlan(){unplan();unplan=()=>{};clearTimeout(planTimer);subscription=null}
function startPlan(){stopPlan();if(!user||!store.watchSlots)return;unplan=store.watchSlots(user.uid,value=>{subscription=value;refreshPlan();if(modal.open&&$('#slot-status'))$('#slot-status').textContent=slotSummary()},error=>toast(friendlyError(error)))}
function slotSummary(){const state=slotState(subscription);return '소유 프로젝트 '+projects.filter(p=>p.owner===user?.uid).length+' / '+state.projects+'개 · 소유 프로젝트마다 개념어 최대 '+state.concepts+'개'}
function showPlan(){
 if(!user)return;
 dialog('슬롯 구매 및 현황','<p id="slot-status">'+esc(slotSummary())+'</p><p>한 번 개방한 슬롯은 만료되지 않습니다. 참여한 프로젝트의 개념어 한도는 소유자의 슬롯을 따릅니다.</p><p class="plan-test">테스트 구매 · 실제 결제나 자동 갱신 없음</p><div class="slot-products">'+PRODUCTS.map(p=>'<button type="button" data-product="'+p.id+'" '+(!native()?'disabled':'')+'><span class="product-shape shape-'+p.id+'" aria-hidden="true"></span><strong>'+p.name+'</strong><span>'+(p.projects?'프로젝트 1개 추가':'')+(p.projects&&p.concepts?' + ':'')+(p.concepts?'개념어 50개 추가':'')+'</span><b>'+p.price.toLocaleString('ko-KR')+'원</b></button>').join('')+'</div><p>'+(native()?'상품을 누르면 테스트 슬롯이 즉시 추가됩니다.':'구매하려면 안드로이드 앱을 설치해 주세요. 앱에서 추가한 슬롯은 웹에서도 적용됩니다.')+'</p>','닫기',async()=>{});
 document.querySelectorAll('[data-product]').forEach(button=>button.onclick=async()=>{const buttons=[...document.querySelectorAll('[data-product]')];buttons.forEach(b=>b.disabled=true);try{await store.purchaseTestSlots(button.dataset.product);toast('테스트 슬롯이 추가되었습니다. 실제 결제는 없습니다.')}catch(error){toast(friendlyError(error))}finally{buttons.forEach(b=>b.disabled=false)}});
}
function accountInquiry(){
 if(!store.cloud)return toast('계정 문의는 Firebase 연결 후 이용할 수 있습니다.');
 dialog('계정 찾기 문의','<p>계정을 찾는 데 도움이 될 정보를 보내 주세요. 비밀번호는 적지 마세요.</p><label for="recovery-email">답변받을 이메일</label><input type="email" id="recovery-email" name="email" maxlength="254" required autocomplete="email"><label for="recovery-message">문의 내용</label><textarea id="recovery-message" name="message" rows="6" maxlength="4000" required></textarea>','개발자에게 보내기',async form=>{await store.sendAccountInquiry(form.get('email'),form.get('message'));toast('계정 문의가 개발자에게 전달되었습니다.')});
}
async function showNotices(){
 dialog('공지사항','<div id="notice-list" role="status">불러오는 중입니다.</div>','닫기',async()=>{});
 if(!store.getNotices){$('#notice-list').textContent='체험 모드에서는 공지사항을 조회할 수 없습니다.';return}
 const target=$('#notice-list');try{const items=await store.getNotices();if(target!==$('#notice-list'))return;target.innerHTML=items.length?items.map(item=>'<article class="feedback-card"><h3>'+esc(item.title)+'</h3><time>'+esc(item.publishedAt?.toDate?.().toLocaleString('ko-KR')||'게시 중')+'</time><p class="feedback-message">'+esc(item.body)+'</p></article>').join(''):'등록된 공지사항이 없습니다.'}catch(error){target.textContent=friendlyError(error)}
}
function composeNotice(){dialog('전체 공지 작성','<label for="notice-title">제목</label><input id="notice-title" name="title" maxlength="100" required><label for="notice-body">내용</label><textarea id="notice-body" name="body" rows="8" maxlength="10000" required></textarea><p>전송하면 모든 사용자가 볼 수 있습니다.</p>','전체 공지 전송',async form=>{await store.publishNotice(form.get('title'),form.get('body'));toast('공지사항을 게시했습니다.')})}
function recentVisits(){try{return JSON.parse(localStorage.getItem('circle-visits-'+user?.uid))||{}}catch{return {}}}
function orderedProjects(){const visits=recentVisits();return [...projects].sort((a,b)=>(Number(visits[b.id])||0)-(Number(visits[a.id])||0))}
function recordVisit(id){try{const visits=recentVisits();visits[id]=Date.now();localStorage.setItem('circle-visits-'+user.uid,JSON.stringify(visits))}catch{}}
function bindSidebarGestures(){
 if(!native())return;const shell=$('.shell');if(!shell?.addEventListener)return;let gesture=null;
 shell.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'||event.isPrimary===false)return;const close=sidebarOpen&&$('#sidebar')?.contains(event.target);if(!close&&event.clientX>24)return;if(event.target.closest('input,textarea,button,a'))return;gesture={id:event.pointerId,x:event.clientX,y:event.clientY,close};shell.setPointerCapture(event.pointerId)},true);
 shell.addEventListener('pointerup',event=>{if(!gesture||gesture.id!==event.pointerId)return;const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;if(Math.abs(dy)<Math.abs(dx)*0.6&&Math.abs(dx)>64){if(gesture.close&&dx<0)setSidebar(false);else if(!gesture.close&&dx>0)setSidebar(true)}gesture=null});
 shell.addEventListener('pointercancel',()=>{gesture=null});
}
function avatar(person,extra=''){
 const p=normalizeProfile(person);
 return `<span class="avatar ${extra}" style="background:${p.color};color:${textColor(p.color)}" aria-hidden="true">${esc(Array.from(p.nickname)[0])}</span>`;
}
function setSidebar(open,focus=false){
 open=native()?open:true;sidebarOpen=open;try{localStorage.setItem('circle-sidebar-open',String(open))}catch{}
 $('.shell')?.classList.toggle('sidebar-expanded',open);
 const sidebar=$('#sidebar');if(sidebar)sidebar.inert=!open;
 $('#sidebar-toggle')?.setAttribute('aria-expanded',String(open));
 $('#sidebar-toggle')?.setAttribute('aria-label',open?'사이드바 접기':'사이드바 펼치기');if(focus)(open?$('#sidebar-close'):$('#sidebar-toggle'))?.focus();
}
function stopProjectPresence(){presence?.stop();presence=null;participants=[];presenceState='connecting'}
function leaveProject(){if(!closeEditor())return;unsubscribe();stopProjectPresence();project=null;if(compact())sidebarOpen=false;renderProjects()}
function refreshPeople(){
 if($('#profile-name'))$('#profile-name').textContent=profile.nickname;
 if($('#profile-avatar'))$('#profile-avatar').innerHTML=avatar(profile);
 if(!$('#participants'))return;
 const others=participants.filter(p=>p.uid!==user?.uid);
 const people=[{...profile,uid:user?.uid},...others];
 $('#participants').innerHTML=people.map(p=>`<div class="participant">${avatar(p)}<span>${esc(p.nickname)}${p.uid===user?.uid?'<small>나</small>':''}</span><i class="online-dot ${presenceState==='live'?'':'pending'}" aria-label="${presenceState==='live'?'접속 중':'연결 확인 중'}"></i></div>`).join('');
 $('#participant-count').textContent=presenceState==='live'?String(people.length):'—';
 $('#presence-status').textContent=presenceState==='live'?'지금 이 프로젝트를 보고 있어요':presenceState==='error'?'참여자 정보를 연결하지 못했습니다.':navigator.onLine===false?'오프라인 · 다시 연결하는 중':'참여자 연결 중…';
}
function updatePresenceActivity(){presence?.setActive(nativeForeground&&!document.hidden&&navigator.onLine!==false)}
function startProjectPresence(){
 stopProjectPresence();if(!project)return;
 presence=createPresenceSession({store,projectId:project.id,uid:user.uid,profile:()=>profile,
  onChange:state=>{participants=state.participants;presenceState=state.state;refreshPeople()},
  onError:error=>{console.error(error);toast('참여자 연결을 확인해 주세요. Firebase 보안 규칙을 갱신해야 할 수 있습니다.')} });
 updatePresenceActivity();refreshPeople();
}
function editProfile(){
 dialog('내 프로필 설정',`<div class="profile-preview" id="profile-preview">${avatar(profile)}</div><label for="nickname">닉네임</label><input name="nickname" id="nickname" value="${esc(profile.nickname)}" maxlength="30" required autocomplete="nickname"><label for="profilecolor">프로필 원 색상</label><input type="color" name="color" id="profilecolor" value="${profile.color}"><p>이 이름과 색상이 프로젝트 참여자 목록에 표시됩니다.</p>`,'저장하기',async form=>{
  const nickname=form.get('nickname').trim();if(!nickname)throw Error('닉네임을 입력하세요.');
  const updated=normalizeProfile({nickname,color:form.get('color')});await store.saveProfile(user.uid,updated);profile=updated;refreshPeople();presence?.refresh();toast('프로필을 저장했습니다.');
 });
 const preview=()=>{$('#profile-preview').innerHTML=avatar({nickname:$('#nickname').value,color:$('#profilecolor').value})};
 $('#nickname').oninput=preview;$('#profilecolor').oninput=preview;
}
function shell(content,map=false){
 app.innerHTML=`<div class="shell"><div class="sidebar-swipe-edge" aria-hidden="true"></div><button class="sidebar-backdrop" id="sidebar-backdrop" aria-label="사이드바 닫기" tabindex="-1"></button><aside class="sidebar" id="sidebar" aria-label="프로젝트 사이드바"><div class="sidebar-heading">${logo()}<button id="sidebar-close" class="quiet icon-button" aria-label="사이드바 접기">‹</button></div>${map?'<section class="members-section"><div class="side-label">현재 접속중 <span id="participant-count">—</span></div><p id="presence-status" class="presence-status">참여자 연결 중…</p><div id="participants"></div></section>':'<div class="workspace-intro">나만의 개념을 정리하고<br>함께 새로운 연결을 찾아보세요.</div>'}<button class="navitem" id="help">ⓘ 사용 가이드</button><div class="side-label">${map?'해시태그':'워크스페이스'}</div><div id="tags">${map?'':'<p class="muted workspace-note">폴더를 선택하여 개념 지도를 여세요.</p>'}</div><div class="side-bottom"><button id="profile-settings" class="profile-button" aria-label="내 프로필 설정"><span id="profile-avatar">${avatar(profile)}</span><span><strong id="profile-name">${esc(profile.nickname)}</strong><small>프로필 설정</small></span><span aria-hidden="true">⚙</span></button><button id="logout" class="quiet logout-button">로그아웃 ↗</button></div></aside><main class="workspace"><header class="topbar"><div class="topbar-left"><button id="sidebar-toggle" class="icon-button" aria-controls="sidebar" aria-label="사이드바 펼치기" aria-expanded="false">☰</button><div class="breadcrumb"><small>워크스페이스</small><strong>${map?esc(project.name):'프로젝트 폴더'}</strong></div></div><div class="topbar-actions">${planControl()}<button type="button" id="send-issue" class="icon-button issue-button" aria-label="이슈 전송" title="이슈 전송">!</button>${map?'<button id="home">프로젝트 폴더로 이동</button><button id="invite">팀 코드 공유</button>':'<button id="join">＋ 초대 코드로 참여</button>'}</div></header><div class="content-view">${content}</div></main></div>`;
 setSidebar(sidebarOpen);bindSidebarGestures();refreshPeople();$('#send-issue').onclick=sendIssue;bindPlanControl();
 $('#sidebar-toggle').onclick=()=>setSidebar(!sidebarOpen,true);$('#sidebar-close').onclick=()=>setSidebar(false,true);$('#sidebar-backdrop').onclick=()=>setSidebar(false,true);
 $('#profile-settings').onclick=editProfile;
 if(map)$('#home').onclick=leaveProject;
 $('#help').onclick=()=>dialog('Circle 사용 가이드','<p>개념 추가로 새 원을 만드세요. 원을 누르면 메모·태그·색상·크기를 편집할 수 있어요.<br><br>한 손가락으로 이동하고, 두 손가락을 벌리거나 모아 확대·축소하세요. 개념이나 #태그를 검색하여 연결을 살펴보세요.<br><br>☰ 버튼으로 사이드바를 펼치면 접속중인 참여자와 프로필 설정을 볼 수 있습니다.</p>','확인',async()=>{});
 $('#logout').onclick=()=>attempt(async()=>{if(!closeEditor())return;unsubscribe();unprojects();unprofile();stopProjectPresence();if(store.cloud)await store.logout();else{store=await createStore();login()}});
 if(map)$('#invite').onclick=()=>share(project);else $('#join').onclick=join;
}
function start(){startPlan();developerMode=false;unfeedback();uninquiries();unprofile();stopProjectPresence();profile=normalizeProfile(null,user);unprofile=store.watchProfile(user.uid,value=>{profile=normalizeProfile(value,user);refreshPeople();presence?.refresh()},error=>{console.error(error);toast('프로필 정보를 불러오지 못했습니다. Firebase 보안 규칙을 확인하세요.')});projects=[];unprojects();unprojects=store.watchProjects(user.uid,p=>{projects=p.filter(item=>!item.deleting||item.owner===user.uid);if(project){const current=p.find(item=>item.id===project.id);if(!current||current.deleting){dirty=false;editorSaving=false;closeEditor();unsubscribe();stopProjectPresence();project=null;toast('프로젝트가 삭제되어 폴더로 돌아갑니다.')}else{project=current;if($('.breadcrumb strong'))$('.breadcrumb strong').textContent=current.name;if($('.map-title h2'))$('.map-title h2').textContent=current.name}}if(!project)renderProjects()},e=>toast(friendlyError(e)));renderProjects()}
function renderProjects(){shell(`<section class="projects"><div class="eyebrow">MAKE ROOM FOR YOUR IDEAS</div><div class="projects-header"><div><h1>나의 생각 보관함</h1><p>어디서부터 시작할까요?</p></div>${native()?'':'<button class="primary" id="newproject">＋ 새 프로젝트</button>'}</div><div class="cards">${orderedProjects().map(p=>`<article class="folder"><span style="font-size:26px;color:#879f74">▱</span><button class="more" data-share="${esc(p.id)}" aria-label="${esc(p.name)} 초대 옵션">···</button><button class="open" data-open="${esc(p.id)}">${esc(p.name)}</button><span class="muted" style="font-size:11px">${p.members?.length||1}명의 멤버 참여 중</span></article>`).join('')}</div>${projects.length?'':'<div class="empty">아직 프로젝트가 없어요. 첫 번째 생각의 공간을 만들어보세요.</div>'}</section>${native()?'<button type="button" class="primary project-add" id="newproject" aria-label="새 프로젝트 만들기" title="새 프로젝트 만들기"><span aria-hidden="true">+</span></button>':''}`);$('#newproject').onclick=()=>dialog('새로운 생각의 공간','<label for="pname">프로젝트 이름</label><input id="pname" name="name" maxlength="60" required placeholder="예: 나의 지식 지도">','프로젝트 만들기',async f=>{if(!f.get('name').trim())throw Error('프로젝트 이름을 입력하세요.');await store.createProject(f.get('name').trim(),user.uid)});document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openProject(projects.find(p=>p.id===b.dataset.open)));document.querySelectorAll('[data-share]').forEach(b=>b.onclick=()=>projectOptions(projects.find(p=>p.id===b.dataset.share)))}
function join(){if(!store.cloud)return toast('팀 참여는 Firebase 연결 후 로그인하면 사용할 수 있어요.');dialog('함께 생각을 연결하세요','<p>공유받은 초대 코드를 입력하면 프로젝트를 함께 보고 편집할 수 있어요.</p><label for="code">팀 초대 코드</label><input name="code" id="code" required autocomplete="off">','프로젝트 참여',async f=>{await store.join(f.get('code').trim());toast('프로젝트에 참여했습니다.')})}
function projectOptions(p){
 const owned=p.owner===user.uid;
 modal.setAttribute('aria-label','프로젝트 옵션');
 modal.innerHTML=`<h2>${esc(p.name)}</h2><p>${p.deleting?'삭제를 마치지 못했습니다. 삭제 버튼으로 다시 시도할 수 있습니다.':owned?'프로젝트를 관리하세요.':'프로젝트 관리는 소유자만 할 수 있습니다.'}</p><div class="project-options"><button type="button" id="option-invite" ${!owned||p.deleting||!store.cloud?'disabled':''}>팀 코드 생성</button><button type="button" id="option-rename" ${!owned||p.deleting?'disabled':''}>프로젝트 이름 수정</button><button type="button" id="option-delete" class="danger" ${!owned?'disabled':''}>프로젝트 삭제</button><button type="button" id="option-close" class="quiet">닫기</button></div>`;
 $('#option-close').onclick=()=>modal.close();
 $('#option-invite').onclick=()=>{if(!owned)return;modal.close();share(p)};
 $('#option-rename').onclick=()=>{if(!owned)return;modal.close();dialog('프로젝트 이름 수정',`<label for="project-name">프로젝트 이름</label><input id="project-name" name="name" maxlength="60" required value="${esc(p.name)}">`,'저장',async form=>{await store.renameProject(p.id,form.get('name').trim(),user.uid);toast('프로젝트 이름을 수정했습니다.')})};
 $('#option-delete').onclick=()=>{if(!owned)return;modal.close();dialog('프로젝트 삭제',`<p><strong>${esc(p.name)}</strong> 프로젝트와 모든 개념·메모를 삭제합니다. 다른 참여자도 더 이상 접근할 수 없으며 되돌릴 수 없습니다.</p>`,'삭제',async()=>{await store.deleteProject(p.id,user.uid);toast('프로젝트를 삭제했습니다.')})};
 modal.showModal();
}
async function share(p){
 if(!store.cloud)return toast('체험 프로젝트는 공유되지 않아요. Firebase 연결이 필요합니다.');
 if(p.owner!==user.uid)return toast('초대 코드는 프로젝트 소유자가 생성할 수 있어요.');
 dialog('프로젝트에 초대하기','<p>새 코드를 생성하면 기존 코드는 만료됩니다. 코드를 받은 로그인 사용자는 이 프로젝트를 편집할 수 있습니다.</p>','코드 생성',async()=>{
  const code=await store.invite(p);
  setTimeout(()=>dialog('팀 초대 코드',`<p>이 코드를 함께 작업할 사람에게 공유하세요.</p><input id="sharecode" readonly value="${esc(code)}" aria-label="초대 코드">`,'복사',async()=>{
   await (native()?window.CircleNative.copyText(code):navigator.clipboard.writeText(code));toast('초대 코드를 복사했습니다.');
  }),0);
 });
}
function openProject(p){if(p.deleting)return projectOptions(p);recordVisit(p.id);stopProjectPresence();if(compact())sidebarOpen=false;project=p;selected=null;filter='';nodes=[];camera={x:0,y:0,z:1};shell(`<div class="canvas" id="canvas"><div class="world" id="world"><svg class="edges" id="edges"></svg><div id="nodes"></div></div><div class="searchbox"><div class="search-inner"><span class="muted">⌕</span><input id="search" aria-label="개념 또는 해시태그 검색" placeholder="어떤 생각을 찾고 있나요?  개념 또는 #태그"><button id="clear" aria-label="검색 초기화">×</button></div><div class="search-help" id="searchhelp">개념을 검색하거나, #태그로 연결을 발견하세요</div></div><div class="map-title"><div class="eyebrow" style="margin-bottom:10px">CONCEPT MAP</div><h2>${esc(p.name)}</h2><p id="count"></p></div><div class="bottom-tools"><div><div class="hint">드래그하여 이동 · 스크롤하여 확대/축소</div><div class="toolgroup"><button id="minus" aria-label="축소">−</button><span class="zoom" id="zoom">100%</span><button id="plus" aria-label="확대">＋</button><span style="color:#ddd">│</span><button id="fit" aria-label="전체 보기">⛶</button></div></div><button class="primary concept-add" id="add" aria-label="개념 만들기" title="개념 만들기"><span aria-hidden="true">+</span></button></div></div>`,true);bindCanvas();startProjectPresence();let first=true;unsubscribe();unsubscribe=store.watchNodes(p.id,ns=>{nodes=ns;draw();if(first){fit(nodes);first=false}},e=>toast(friendlyError(e)));$('#add').onclick=()=>{if(!closeEditor())return;const rect=$('#canvas').getBoundingClientRect();edit({id:crypto.randomUUID(),name:'',memo:'',tags:[],color:colors[0],size:150,x:(rect.width/2-camera.x)/camera.z,y:(rect.height/2-camera.y)/camera.z},true)}}
function sceneNodes(){const list=nodes.map(n=>editorDraft?.id===n.id?{...n,...editorDraft.fields}:n);if(editorDraft?.isNew&&!list.some(n=>n.id===editorDraft.id))list.push({...editorDraft.origin,...editorDraft.fields});return list}
function dragNode(id){return nodes.find(n=>n.id===id)||(editorDraft?.isNew&&editorDraft.id===id?editorDraft.origin:null)}
function matches(){const list=sceneNodes(),q=filter.trim().toLocaleLowerCase();return !q?list:list.filter(n=>q.startsWith('#')?n.tags.some(t=>t.toLocaleLowerCase()===q.slice(1)):n.name.toLocaleLowerCase().includes(q))}
function draw(){if(!$('#nodes'))return;const list=sceneNodes(),found=matches(),ids=new Set(found.map(n=>n.id));$('#nodes').innerHTML=list.map(n=>`<button class="node ${filter&&!ids.has(n.id)?'dim':''} ${selected===n.id?'selected':''}" data-node="${esc(n.id)}" aria-label="${esc(n.name)} 메모 편집" style="left:${n.x-n.size/2}px;top:${n.y-n.size/2}px;width:${n.size}px;height:${n.size}px;--node-label-size:${n.size*16/150}px;--node-tag-size:${n.size*9/150}px;--node-gap:${n.size/15}px;background:${safeColor(n.color)};color:${textColor(n.color)}"><strong>${esc(n.name)}</strong><small>${n.tags.slice(0,2).map(t=>'#'+esc(t)).join('　')}</small></button>`).join('');$('#edges').innerHTML=filter.startsWith('#')?found.slice(1).map((n,i)=>`<line x1="${found[i].x}" y1="${found[i].y}" x2="${n.x}" y2="${n.y}"/>`).join(''):'';$('#count').textContent=`${list.length}개의 개념`;const tags=[...new Set(list.flatMap(n=>n.tags))];$('#tags').innerHTML=tags.map(t=>`<button class="tag-row" data-tag="${esc(t)}"><span class="tag-dot"></span># ${esc(t)}<span style="margin-left:auto;color:#a3ad9a">${list.filter(n=>n.tags.includes(t)).length}</span></button>`).join('')||'<div class="muted" style="font-size:11px;padding:12px">개념에 태그를 추가해보세요.</div>';document.querySelectorAll('[data-tag]').forEach(b=>b.onclick=()=>{$('#search').value='#'+b.dataset.tag;search()});transform()}
function transform(animate=false){$('#world')?.classList.toggle('animate',animate);if($('#world'))$('#world').style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.z})`;if($('#zoom'))$('#zoom').textContent=Math.round(camera.z*100)+'%'}
function fit(list){if(!list.length)return;const el=$('#canvas');let left=Math.min(...list.map(n=>n.x-n.size/2)),right=Math.max(...list.map(n=>n.x+n.size/2)),top=Math.min(...list.map(n=>n.y-n.size/2)),bottom=Math.max(...list.map(n=>n.y+n.size/2));const width=el.clientWidth-($('#editor')?Math.min(350,el.clientWidth-5):0);camera.z=Math.max(.02,Math.min(1.3,(Math.max(100,width-100))/(right-left),Math.max(100,el.clientHeight-250)/(bottom-top)));camera.x=width/2-(left+right)/2*camera.z;camera.y=el.clientHeight/2+35-(top+bottom)/2*camera.z;transform(true)}
function search(){filter=$('#search').value.trim();draw();const found=matches();$('#searchhelp').textContent=filter?(found.length?`${found.length}개의 개념을 찾았어요 · Esc로 돌아가기`:'일치하는 개념이 없어요'):'개념을 검색하거나, #태그로 연결을 발견하세요';if(found.length)fit(found)}
function zoom(f,x,y){const old=camera.z;camera.z=Math.max(.02,Math.min(3,old*f));camera.x=x-(x-camera.x)*camera.z/old;camera.y=y-(y-camera.y)*camera.z/old;transform()}
function bindCanvas(){
 const c=$('#canvas'),pointers=new Map();let drag=null,pinch=null;
 const point=e=>({x:e.clientX,y:e.clientY});
 function startPinch(){
  const [a,b]=[...pointers.values()],r=c.getBoundingClientRect();
  const x=(a.x+b.x)/2-r.left,y=(a.y+b.y)/2-r.top;
  pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),z:camera.z,worldX:(x-camera.x)/camera.z,worldY:(y-camera.y)/camera.z};
 }
 function persistDrag(){
  if(!drag?.id||!drag.moved)return;
  const n=dragNode(drag.id);
  if(n&&(!editorDraft?.isNew||editorDraft.id!==n.id))attempt(()=>store.moveNode(project.id,n.id,n.x,n.y));
 }
 c.onpointerdown=e=>{
  if(e.button!==0||e.target.closest('.searchbox,.bottom-tools'))return;
  e.preventDefault();window.getSelection()?.removeAllRanges();pointers.set(e.pointerId,point(e));c.setPointerCapture(e.pointerId);
  if(pointers.size>=2){persistDrag();drag=null;startPinch();return}
  const b=e.target.closest('[data-node]'),n=b?dragNode(b.dataset.node):null;
  drag={id:n?.id,sx:e.clientX,sy:e.clientY,cx:camera.x,cy:camera.y,nx:n?.x,ny:n?.y,moved:false};
 };
 c.onpointermove=e=>{
  if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,point(e));
  if(pinch&&pointers.size>=2){
   const [a,b]=[...pointers.values()],r=c.getBoundingClientRect();
   camera.z=Math.max(.02,Math.min(3,pinch.z*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance));
   camera.x=(a.x+b.x)/2-r.left-pinch.worldX*camera.z;camera.y=(a.y+b.y)/2-r.top-pinch.worldY*camera.z;transform();return;
  }
  if(!drag)return;const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;
  if(Math.hypot(dx,dy)>4)drag.moved=true;if(!drag.moved)return;
  if(drag.id){const n=dragNode(drag.id);if(!n)return;n.x=drag.nx+dx/camera.z;n.y=drag.ny+dy/camera.z;draw()}
  else{camera.x=drag.cx+dx;camera.y=drag.cy+dy;transform()}
 };
 function endPointer(e,cancelled=false){
  if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);
  if(pinch){
   if(pointers.size>=2)startPinch();
   else{pinch=null;const remaining=[...pointers.values()][0];drag=remaining?{sx:remaining.x,sy:remaining.y,cx:camera.x,cy:camera.y,moved:true}:null}
  }else if(drag){
   const d=drag;persistDrag();drag=null;
   if(!cancelled&&!d.moved){
    if(d.id){const n=dragNode(d.id);if(n&&editorDraft?.id!==d.id&&closeEditor())edit(n)}
    else if($('#editor'))closeEditor();
   }
  }
  if(c.hasPointerCapture(e.pointerId))c.releasePointerCapture(e.pointerId);
 }
 c.onpointerup=e=>endPointer(e);c.onpointercancel=e=>endPointer(e,true);c.onlostpointercapture=e=>endPointer(e,true);
 c.onkeydown=e=>{const b=e.target.closest('[data-node]');if(b&&(e.key==='Enter'||e.key===' ')){e.preventDefault();if(editorDraft?.id!==b.dataset.node&&closeEditor())edit(dragNode(b.dataset.node))}};
 c.addEventListener('wheel',e=>{e.preventDefault();const r=c.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top)},{passive:false});
 $('#plus').onclick=()=>zoom(1.2,c.clientWidth/2,c.clientHeight/2);$('#minus').onclick=()=>zoom(1/1.2,c.clientWidth/2,c.clientHeight/2);$('#fit').onclick=()=>fit(matches());
 let timer;$('#search').oninput=()=>{clearTimeout(timer);timer=setTimeout(search,180)};$('#clear').onclick=()=>{clearTimeout(timer);$('#search').value='';search()};
}

let dirty=false;
function closeEditor(){if(editorSaving)return false;if(dirty&&!confirm('저장하지 않은 변경 사항을 닫을까요?'))return false;$('#editor')?.remove();$('.content-view')?.classList.remove('editing');dirty=false;selected=null;editorDraft=null;draw();return true}
function edit(n,isNew=false){selected=n.id;editorDraft={id:n.id,isNew,origin:{...n},fields:{name:n.name,memo:n.memo,tags:[...n.tags],color:safeColor(n.color),size:n.size}};draw();if(compact())setSidebar(false);const panel=document.createElement(compact()?'dialog':'aside');panel.className='editor';panel.id='editor';panel.setAttribute('aria-label',isNew?'개념 만들기':'개념 편집');panel.innerHTML=`<div class="editor-head"><h2>${isNew?'개념 만들기':'개념 편집'}</h2><button class="quiet" id="closeeditor" aria-label="편집 닫기">×</button></div><div class="preview-circle" id="preview" style="background:${safeColor(n.color)};color:${textColor(n.color)}">${esc(n.name||'새로운 생각')}</div><form id="editform"><label for="nname">개념 이름</label><input id="nname" name="name" maxlength="80" required value="${esc(n.name)}" placeholder="어떤 개념인가요?"><label for="memo">개념 노트</label><textarea id="memo" name="memo" rows="7" maxlength="20000" placeholder="이 개념에 대한 생각을 자유롭게 적어보세요.">${esc(n.memo)}</textarea><label for="ntags">해시태그</label><input id="ntags" name="tags" value="${esc(n.tags.map(t=>'#'+t).join(' '))}" placeholder="#아이디어 #학습"><p class="muted" style="font-size:10px">공백 또는 쉼표로 태그를 구분하세요.</p><label>원의 색상</label><div class="swatches">${colors.map((c,i)=>`<button type="button" aria-label="색상 ${i+1}" class="swatch ${c===n.color?'chosen':''}" data-color="${c}" style="background:${c}"></button>`).join('')}</div><div class="color-panel"><label for="customcolor">직접 선택 · RGB</label><div class="color-picker-row"><input type="color" id="customcolor" aria-label="색상 패널 열기" value="${safeColor(n.color)}"><output id="colorhex">${safeColor(n.color).toUpperCase()}</output></div><div class="rgb-fields">${toRGB(n.color).map((value,i)=>`<label for="rgb${i}">${['R','G','B'][i]}<input type="number" id="rgb${i}" data-channel="${i}" min="0" max="255" step="1" required value="${value}" inputmode="numeric"></label>`).join('')}</div></div><label for="size">원의 크기 <span id="sizeval" class="muted">${n.size}px</span></label><input type="range" min="90" max="250" step="1" name="size" id="size" value="${n.size}"><div class="editor-actions"><button type="button" class="quiet danger" id="delete" ${isNew?'disabled':''}>개념 삭제</button><button class="primary">저장하기</button></div></form>`;$('.content-view').append(panel);$('.content-view').classList.add('editing');if(panel.tagName==='DIALOG'){panel.showModal();panel.oncancel=e=>{e.preventDefault();closeEditor()};panel.addEventListener('click',e=>{if(e.target===panel){const r=panel.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeEditor()}})}let color=safeColor(n.color);const updateDraft=()=>{if(!editorDraft||editorDraft.id!==n.id)return;editorDraft.fields={name:$('#nname').value,memo:$('#memo').value,tags:[...new Set($('#ntags').value.split(/[\s,#]+/).filter(Boolean))].slice(0,20),color,size:Number($('#size').value)};const preview=$('#preview');preview.textContent=$('#nname').value||'새로운 생각';preview.style.background=color;preview.style.color=textColor(color);preview.style.width=$('#size').value+'px';preview.style.height=$('#size').value+'px';preview.style.fontSize=Number($('#size').value)*16/150+'px';$('#sizeval').textContent=$('#size').value+'px';draw()};const applyColor=value=>{color=safeColor(value);dirty=true;$('#customcolor').value=color;$('#colorhex').textContent=color.toUpperCase();toRGB(color).forEach((value,i)=>{$('#rgb'+i).value=value});document.querySelectorAll('.swatch').forEach(b=>b.classList.toggle('chosen',b.dataset.color===color));$('#preview').style.background=color;$('#preview').style.color=textColor(color);updateDraft()};$('#customcolor').oninput=e=>applyColor(e.target.value);document.querySelectorAll('[data-channel]').forEach(input=>input.oninput=()=>{const fields=[0,1,2].map(i=>$('#rgb'+i));if(fields.every(f=>f.value!==''&&f.checkValidity()))applyColor(fromRGB(fields.map(f=>Number(f.value))))});$('#closeeditor').onclick=closeEditor;$('#editform').oninput=()=>{dirty=true;updateDraft()};updateDraft();document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{applyColor(b.dataset.color)});$('#editform').onsubmit=e=>{e.preventDefault();attempt(async()=>{if(!$('#nname').value.trim())throw Error('개념 이름을 입력하세요.');const data={name:$('#nname').value.trim(),memo:$('#memo').value,tags:[...new Set($('#ntags').value.split(/[\s,#]+/).filter(Boolean))].slice(0,20),color,size:Number($('#size').value)};const b=e.submitter||$('#editform button.primary');b.disabled=true;editorSaving=true;try{await store.saveNode(project.id,n.id,isNew?{...data,x:editorDraft.origin.x,y:editorDraft.origin.y}:data,isNew);dirty=false;editorSaving=false;closeEditor();toast('개념을 저장했습니다.')}finally{editorSaving=false;b.disabled=false}})};$('#delete').onclick=()=>{if(editorSaving)return;if(confirm('이 개념과 메모를 삭제할까요?'))attempt(async()=>{await store.deleteNode(project.id,n.id);dirty=false;closeEditor();toast('개념을 삭제했습니다.')})}}
function handleAppBack(){
 if(modal.open){modal.close();return true}
 if($('#editor')){closeEditor();return true}
 if($('#search')?.value){$('#search').value='';search();return true}
 if(sidebarOpen&&compact()){setSidebar(false);return true}
 if(project){leaveProject();return true}
 return false;
}
window.addEventListener('circle:back',event=>{if(handleAppBack())event.preventDefault()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.open){if($('#editor'))closeEditor();else if(sidebarOpen&&compact())setSidebar(false,true);else if($('#search')){$('#search').value='';search()}}});window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
document.addEventListener('visibilitychange',()=>{updatePresenceActivity();refreshPlan()});
window.addEventListener('online',()=>{updatePresenceActivity();presence?.refresh()});
window.addEventListener('offline',updatePresenceActivity);
window.addEventListener('circle:active',event=>{nativeForeground=event.detail.isActive;updatePresenceActivity()});
window.addEventListener('pagehide',()=>presence?.setActive(false));
window.addEventListener('pageshow',updatePresenceActivity);
function updateViewport(){
 const view=window.visualViewport;
 document.documentElement.style.setProperty('--viewport-height',Math.round(view?.height||window.innerHeight)+'px');
 document.documentElement.style.setProperty('--viewport-top',Math.round(view?.offsetTop||0)+'px');
}
window.addEventListener('resize',updateViewport);window.visualViewport?.addEventListener('resize',updateViewport);window.visualViewport?.addEventListener('scroll',updateViewport);updateViewport();
try{store=await createStore();if(store.cloud)store.onAuth(handleAuth);else login()}catch(e){app.innerHTML='<p style="padding:40px">서비스에 연결하지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.</p>';toast(friendlyError(e))}

