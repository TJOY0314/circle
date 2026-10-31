export const DEVELOPER_EMAIL = 'secretcode@circle.invalid';

export function loginEmail(value) {
  const id = String(value || '').trim();
  return id.toLowerCase() === 'secretcode' ? DEVELOPER_EMAIL : id;
}

export function friendlyError(error) {
  const messages = {
    'auth/email-already-in-use': '이미 등록된 이메일입니다. 로그인해 주세요.',
    'auth/invalid-email': '이메일 주소를 올바르게 입력해 주세요.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/invalid-login-credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/wrong-password': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/user-not-found': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/weak-password': '비밀번호는 6자 이상으로 입력해 주세요.',
    'auth/missing-password': '비밀번호를 입력해 주세요.',
    'auth/user-disabled': '사용이 중지된 계정입니다. 개발자에게 문의해 주세요.',
    'auth/too-many-requests': '시도 횟수가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    'auth/network-request-failed': '인터넷 연결을 확인하고 다시 시도해 주세요.',
    'auth/popup-closed-by-user': 'Google 로그인이 취소되었습니다.',
    'auth/cancelled-popup-request': '이미 열린 로그인 창에서 계속 진행해 주세요.',
    'auth/popup-blocked': '로그인 창이 차단되었습니다. 팝업을 허용한 뒤 다시 시도해 주세요.',
    'auth/operation-not-allowed': '현재 이 로그인 방법을 사용할 수 없습니다. 개발자에게 문의해 주세요.',
    'auth/unauthorized-domain': '현재 사이트에서 로그인을 사용할 수 없습니다. 개발자에게 문의해 주세요.',
    'auth/account-exists-with-different-credential': '다른 방법으로 가입한 계정입니다. 처음 가입한 방법으로 로그인해 주세요.',
    'permission-denied': '이 작업을 할 권한이 없거나 서비스 설정이 완료되지 않았습니다.',
    'unavailable': '서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.',
    'circle/developer-access': '개발자 접근 권한이 없습니다. 개발자 계정 설정을 확인해 주세요.',
  };
  if (messages[error?.code]) return messages[error.code];
  if (error?.code || /firebase|auth\/|firestore/i.test(error?.message || '')) {
    return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }
  return error?.message || '요청을 처리하지 못했습니다. 다시 시도해 주세요.';
}
