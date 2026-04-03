// src/hooks/use-geo.ts
import { useState, useEffect } from "react";

export function useUserCountry() {
  const [countryCode, setCountryCode] = useState<string | null>(null);

  useEffect(() => {
    // Consultamos la IP del usuario de forma silenciosa y asíncrona
    fetch("https://get.geojs.io/v1/ip/country.json")
      .then((res) => res.json())
      .then((data) => {
        setCountryCode(data.country); // Devuelve 'US', 'CL', 'BR', 'AR', etc.
      })
      .catch((err) => {
        console.error("Error detectando país:", err);
        setCountryCode("UNKNOWN"); // Fallback de seguridad
      });
  }, []);

  return countryCode;
}