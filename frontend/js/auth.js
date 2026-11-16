// This file initializes Firebase authentication and provides an Auth object for the frontend to use. It handles user login, signup, logout
(function () {
  firebase.initializeApp(window.AWAAZ.firebase);
  const fbAuth = firebase.auth();
  const listeners = [];
  let resolveReady;
  const Auth = {
    user: null,
    ready: new Promise((r) => (resolveReady = r)),
    onChange(fn) { listeners.push(fn); fn(Auth.user); },
    async token(force) { return Auth.user ? Auth.user.getIdToken(!!force) : null; },
    async login(email, password) { return fbAuth.signInWithEmailAndPassword(email, password); },
    async signup(name, email, password) {
      const cred = await fbAuth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: name });
      await cred.user.getIdToken(true); // refresh so the new name is inside the token the server sees
      return cred;
    },
    async google() { return fbAuth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); },
    async reset(email) { return fbAuth.sendPasswordResetEmail(email); },
    async logout() { return fbAuth.signOut(); },
  };
  fbAuth.onAuthStateChanged((u) => {
    Auth.user = u;
    resolveReady(u);
    listeners.forEach((fn) => fn(u));
  });
  window.Auth = Auth;
})();
