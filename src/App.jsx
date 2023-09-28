import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { format, differenceInDays, parse } from "date-fns";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const firebaseConfig = {
  apiKey: "AIzaSyATgn2F4KCWy0PzozN4exO2PZ5nVMF0m9Q",
  authDomain: "cultivacao-68960.firebaseapp.com",
  projectId: "cultivacao-68960",
  storageBucket: "cultivacao-68960.appspot.com",
  messagingSenderId: "901466443570",
  appId: "1:901466443570:web:05e6960cc36b39749f512b",
  measurementId: "G-3P4QDPZPTN",
};

// Initialize Firebase
initializeApp(firebaseConfig);

const db = getFirestore();
const notify = (msg) => toast(msg);

const NewLoan = ({ addLoan }) => {
  const { register, handleSubmit, reset } = useForm();
  const storage = getStorage();

  const [whatsappPhone, setWhatsappPhone] = useState("");
  const normalizePhoneNumber = (input) => {
    let normalizedNumber = input.replace(/\D/g, "");
    if (!normalizedNumber.startsWith("55")) {
      normalizedNumber = "55" + normalizedNumber;
    }
    return "+" + normalizedNumber;
  };

  const handleInputChange = (event) => {
    setWhatsappPhone(normalizePhoneNumber(event.target.value));
  };

  const onSubmit = async (data) => {
    const loan = {
      ...data,
      loanDate: format(new Date(), "dd/MM/yyyy"),
      status: "emprestado", // Status padrão
    };
    if (data.productPhoto[0]) {
      const storageRef = ref(storage, `images/${data.productPhoto[0].name}`);
      await uploadBytesResumable(storageRef, data.productPhoto[0]);
      const url = await getDownloadURL(storageRef);
      loan.productPhoto = url;
    }
    addLoan(loan);
    // Adicione o novo empréstimo ao Firestore
    try {
      await setDoc(doc(db, "loans", data.id), loan);
      notify("Empréstimo cadastrado com sucesso!");
      reset();
      setWhatsappPhone("");
    } catch (e) {
      notify("Opa! Não foi possível cadastrar, tente corrigir as informações");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("id")} placeholder="Código do produto" required />
      <input
        {...register("itemDescription")}
        placeholder="Descrição do Item"
        required
      />
      <input {...register("approximateValue")} placeholder="Valor Aproximado" />
      <input type="file" {...register("productPhoto")} />
      <input {...register("requester")} placeholder="Solicitante" required />
      <input
        {...register("requesterAddress")}
        placeholder="Endereço do Solicitante"
        required
      />
      <input
        {...register("whatsappPhone")}
        value={whatsappPhone}
        onChange={handleInputChange}
        type="phone"
        placeholder="Telefone Ex: 19 9XXXXXXXX"
        required
      />
      <input {...register("lender")} placeholder="Quem Emprestou" required />
      <button className="btn-grad" type="submit">
        Salvar
      </button>
    </form>
  );
};

const EquipmentLoan = () => {
  const [loans, setLoans] = useState([]);
  const [search, setSearch] = useState("");

  const fetchLoans = async () => {
    const querySnapshot = await getDocs(collection(db, "loans"));
    const loans = querySnapshot.docs.map((doc) => doc.data());
    setLoans(loans);
  };
  useEffect(() => {
    fetchLoans();
  }, []);

  const addLoan = (loan) => {
    setLoans([...loans, loan]);
  };
  const openWhatsApp = (phone) => {
    const url = `https://wa.me/${phone}`;
    window.open(url, "_blank");
  };

  const updateLoanStatus = async (id, status) => {
    if (!id) {
      notify(
        "Produto não encontrado na base de dados, contate o administrado do sistema"
      );
      return;
    }

    const loanRef = doc(db, "loans", id);

    // Verifique se o documento existe
    const docSnap = await getDoc(loanRef);

    if (docSnap.exists()) {
      // Se o documento existir, verifique o status
      if (status === "devolvido") {
        // Se o status for "devolvido", exclua o documento
        await deleteDoc(loanRef);
        setLoans(loans.filter((loan) => loan.id !== id));
        notify("Empréstimo foi devolvido com sucesso!");
      } else {
        // Se o status não for "devolvido", atualize-o
        await updateDoc(loanRef, { status });
        setLoans(
          loans.map((loan) => (loan.id === id ? { ...loan, status } : loan))
        );
        notify("Status atualizado!");
      }
    }
  };

  const checkLoanStatus = async () => {
    for (let loan of loans) {
      const loanDate = parse(loan.loanDate, "dd/MM/yyyy", new Date());
      if (
        differenceInDays(new Date(), loanDate) > 30 &&
        loan.status === "emprestado"
      ) {
        await updateLoanStatus(loan.id, "pendente de renovação");
      }
    }
  };

  checkLoanStatus();

  return (
    <div>
      <ToastContainer />
      <div className="titulo">
        <h1>Grupo Cultivação</h1>
        <p>Paróquia Santa Luzia - Limeira/SP</p>
      </div>
      <NewLoan addLoan={addLoan} />
      <input
        className="pesquisa"
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Pesquisar..."
      />
      {loans &&
        loans
          .filter(
            (loan) =>
              loan.status !== "devolvido" &&
              JSON.stringify(loan).toLowerCase().includes(search.toLowerCase())
          )
          .map((loan, index) => (
            <div key={index} className="produtos">
              <h2>Empréstimo {index + 1}</h2>
              <p>Nº de Identificação: {loan.id}</p>
              <p>Descrição do Item: {loan.itemDescription}</p>
              <p>Valor Aproximado R$: {loan.approximateValue}</p>
              <p>
                Foto do Produto:{" "}
                <img src={loan.productPhoto} alt="Foto do Produto" />
              </p>
              <p>Solicitante: {loan.requester}</p>
              <p>Endereço do Solicitante: {loan.requesterAddress}</p>
              <p>
                Telefone WhatsApp:
                <button onClick={() => openWhatsApp(loan.whatsappPhone)}>
                  {loan.whatsappPhone}
                </button>
              </p>
              <p>Quem Emprestou: {loan.lender}</p>
              <p>
                Status:
                <select
                  value={loan.status}
                  onChange={(e) => {
                    updateLoanStatus(loan.id, e.target.value);
                  }}
                >
                  <option value="emprestado">Emprestado</option>
                  <option value="pendente de renovação">
                    Pendente de Renovação
                  </option>
                  <option value="renovado">Renovado</option>
                  <option value="devolvido">Devolvido</option>
                </select>
              </p>
              <p>Data do Empréstimo: {loan.loanDate}</p>
            </div>
          ))}
    </div>
  );
};

export default EquipmentLoan;
