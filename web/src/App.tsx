import "./App.css";
import { Route, Routes } from "react-router-dom";
import Join from "./pages/Join";
import Chat from "./pages/Chat";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Join />} />
      <Route path="/chat" element={<Chat />} />
    </Routes>
  );
}

export default App;
