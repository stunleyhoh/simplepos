import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { adminEmail, firebaseConfig } from "./firebase-config.local.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function emit(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

async function getCloudUser(email) {
  const normalized = normalizeEmail(email);
  const snapshot = await getDoc(doc(db, "users", normalized));
  if (snapshot.exists()) return { id: snapshot.id, ...snapshot.data() };
  if (normalized === adminEmail) {
    const adminUser = {
      email: adminEmail,
      name: "Stanley Hoh",
      role: "admin",
      branchId: "hq",
      active: true,
      createdAt: serverTimestamp()
    };
    await setDoc(doc(db, "users", adminEmail), adminUser, { merge: true });
    return { id: adminEmail, ...adminUser };
  }
  return null;
}

async function loadCollection(name) {
  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function saveBranch(branch) {
  await setDoc(doc(db, "branches", branch.id), {
    ...branch,
    active: branch.active ?? true,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function saveAuthorizedUser(user) {
  const email = normalizeEmail(user.email);
  await setDoc(doc(db, "users", email), {
    ...user,
    email,
    active: user.active ?? true,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function saveProduct(product) {
  await setDoc(doc(db, "products", product.id), {
    ...product,
    active: product.active ?? true,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function saveSale(sale) {
  await setDoc(doc(db, "sales", sale.id), {
    ...sale,
    syncStatus: "synced",
    syncedAt: serverTimestamp()
  }, { merge: true });
}

async function signInWithGoogle() {
  await signInWithPopup(auth, provider);
}

async function signOutGoogle() {
  await signOut(auth);
}

window.cloudPOS = {
  auth,
  db,
  signInWithGoogle,
  signOutGoogle,
  getCloudUser,
  loadCollection,
  saveBranch,
  saveAuthorizedUser,
  saveProduct,
  saveSale
};

onAuthStateChanged(auth, async (firebaseUser) => {
  if (!firebaseUser) {
    emit("cloud-auth-change", { firebaseUser: null, appUser: null });
    return;
  }

  try {
    const appUser = await getCloudUser(firebaseUser.email);
    emit("cloud-auth-change", { firebaseUser, appUser });
  } catch (error) {
    emit("cloud-error", { message: error.message });
  }
});

emit("cloud-ready", { projectId: firebaseConfig.projectId });
