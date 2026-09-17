import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut as fbSignOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, collection, doc, getDoc, onSnapshot, updateDoc, setDoc, addDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, STORE_ID, STAFF_EMAIL, TODAY_CATEGORY } from "./config.js";

// 写真は Storage ではなく Firestore に base64 で置く（Storage は有料プラン必須のため）
//   items/{id}.photoUrl  … 一覧用サムネ data URL（約10KB）
//   photos/{id}.data     … 品ページ用 data URL（約250KB・開いた時だけ読む）

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { localCache: persistentLocalCache() });
const auth = getAuth(app);
const itemsCol = () => collection(db, "menus", STORE_ID, "items");
const photoDoc = (id) => doc(db, "menus", STORE_ID, "photos", id);

const fmt = (ts) => ts?.toDate ? ts.toDate().toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

export function subscribeItems(cb) {
  return onSnapshot(itemsCol(), (snap) => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data(), updatedAt: fmt(d.data().updatedAt) })));
  }, (err) => console.error("subscribe", err));
}
export async function loadPhoto(id) {
  const s = await getDoc(photoDoc(id));
  return s.exists() ? s.data().data : null;
}
export async function signIn(password) {
  await setPersistence(auth, browserLocalPersistence);
  await signInWithEmailAndPassword(auth, STAFF_EMAIL, password);
}
export const signOut = () => fbSignOut(auth);
export const isSignedIn = () => !!auth.currentUser;
export const onAuth = (cb) => onAuthStateChanged(auth, (u) => cb(!!u));

export async function saveItem(id, fields) {
  await updateDoc(doc(itemsCol(), id), { ...fields, updatedAt: serverTimestamp(), updatedBy: "staff" });
}
export async function addTodayItem(name) {
  const r = await addDoc(itemsCol(), { name, category: TODAY_CATEGORY, price: null, order: Date.now(),
    ingredients: [], steps: "", photoUrl: null, hidden: false,
    updatedAt: serverTimestamp(), updatedBy: "staff" });
  return r.id;
}
export async function deleteItem(id) {
  await deleteDoc(doc(itemsCol(), id));
  await deleteDoc(photoDoc(id)).catch(() => {});
}
// 旧写真は photos/{id}.prev に1世代だけ残す
export async function savePhoto(id, { thumb, full }) {
  const cur = await getDoc(photoDoc(id));
  await setDoc(photoDoc(id), { data: full, prev: cur.exists() ? cur.data().data : null, updatedAt: serverTimestamp() });
  await saveItem(id, { photoUrl: thumb });
}
