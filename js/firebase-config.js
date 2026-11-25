// ===== Firebase の設定 =====
// Firebase のページでコピーした「firebaseConfig」の中身を、下の '' の中に貼りつけます。
// （くわしい手順は docs/firebase-setup.md を見てください）
//
// まだ空っぽのままだと「テストモード」になり、記録はこの端末の中だけに残ります。
window.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDPJyWBzkkFFMsVXLtmbwX-Z9OIEL2mtOo',
  authDomain: 'hayaoshi-quiz-635b7.firebaseapp.com',
  databaseURL: 'https://hayaoshi-quiz-635b7-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'hayaoshi-quiz-635b7',
  storageBucket: 'hayaoshi-quiz-635b7.firebasestorage.app',
  messagingSenderId: '1084024224289',
  appId: '1:1084024224289:web:67f8bccf96c13690e54160',
};

// 先生用画面（admin.html）にログインする先生のメールアドレス
// Firebase の Authentication で、このメールアドレスの先生アカウントを作っておく（パスワードは先生だけが知っている）。
// database.rules.json の中にも同じメールアドレスが書いてある（変えるときは両方そろえる）。
// 本物のメールアドレスでなくてよい（ログインの名前として使うだけ）。
window.TEACHER_EMAIL = 'sensei@example.com';
