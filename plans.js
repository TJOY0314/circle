export const FREE_PROJECT_LIMIT=3, FREE_NODE_LIMIT=50;
export const PRODUCTS=Object.freeze([
 {id:'circle',name:'circle',projects:0,concepts:1,price:990},
 {id:'squre',name:'squre',projects:1,concepts:0,price:1990},
 {id:'pentagon',name:'pentagon',projects:1,concepts:1,price:2500}
]);
export function slotState(value){const valid=n=>Number.isSafeInteger(n)&&n>=0?n:0;return {projects:3+valid(value?.projectSlots),concepts:50+50*valid(value?.conceptSlots)}}
export function addSlots(value,id){const product=PRODUCTS.find(p=>p.id===id);if(!product)throw Error('상품을 확인해 주세요.');const state=slotState(value);return {mode:'test',projectSlots:state.projects-3+product.projects,conceptSlots:(state.concepts-50)/50+product.concepts}}
export function checkProjectLimit(count,slots){const limit=slotState(slots).projects;if(count>=limit)throw Error('소유 프로젝트는 '+limit+'개까지 만들 수 있습니다. 슬롯을 추가해 주세요.')}
export function checkNodeLimit(count,slots){const limit=slotState(slots).concepts;if(count>=limit)throw Error('이 프로젝트에는 개념어를 '+limit+'개까지 만들 수 있습니다. 프로젝트 소유자가 슬롯을 추가해 주세요.')}
