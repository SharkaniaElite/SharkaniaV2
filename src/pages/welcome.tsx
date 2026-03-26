// src/pages/welcome.tsx
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getSession } from "../lib/api/auth";

export default function WelcomePage() {
  const [userName, setUserName] = useState("Jugador");

  useEffect(() => {
    // Al cargar, obtenemos la sesión que Supabase acaba de verificar
    getSession().then((session) => {
      if (session?.user?.user_metadata?.display_name) {
        setUserName(session.user.user_metadata.display_name);
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#18181b] border border-white/10 rounded-2xl p-8 text-center shadow-2xl">
        
        {/* Ícono de éxito */}
        <div className="w-20 h-20 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-cyan-500/20">
          <span className="text-4xl">🦈</span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">
          ¡Cuenta Verificada!
        </h1>
        
        <p className="text-zinc-400 mb-8 leading-relaxed">
          Bienvenido a la arena, <strong className="text-cyan-400">{userName}</strong>. 
          Tu correo ha sido confirmado con éxito y tu sesión ya está iniciada.
        </p>

        <div className="flex flex-col gap-4">
          <Link 
            to="/dashboard" 
            className="w-full bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-bold py-3 px-4 rounded-lg transition-colors duration-200"
          >
            Ir a mi Panel
          </Link>
          
          <Link 
            to="/" 
            className="w-full bg-transparent hover:bg-white/5 text-zinc-300 border border-zinc-700 font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
          >
            Volver al Inicio
          </Link>
        </div>
      </div>
    </div>
  );
}