import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface WelcomeVerificationProps {
  playerNickname?: string;
  verificationLink?: string;
}

export const WelcomeVerificationEmail = ({
  playerNickname = 'Jugador',
  verificationLink = 'https://sharkania.com/verify?token=demo_token',
}: WelcomeVerificationProps) => {
  return (
    <Html>
      <Head />
      <Preview>Bienvenido a Sharkania. Verifica tu cuenta y libera tus 100 Shark Coins.</Preview>
      <Body style={main}>
        <Container style={container}>
          
          {/* Header Minimalista */}
          <Section style={header}>
            <Text style={brand}>SHARKANIA</Text>
            <Text style={badge}>SYSTEM UPDATE</Text>
          </Section>

          <Heading style={heading}>
            INICIALIZANDO PERFIL ELO
          </Heading>

          <Text style={paragraph}>
            Hola, <strong style={highlight}>{playerNickname}</strong>.
          </Text>
          
          <Text style={paragraph}>
            Tu infraestructura competitiva ha sido generada. Has sido seleccionado para acceder a la Beta privada de Sharkania, el motor global de análisis de póker basado en datos.
          </Text>

          {/* Caja de Datos / Terminal Style */}
          <Section style={dataBox}>
            <Text style={dataBoxTitle}>ESTADO DEL SISTEMA</Text>
            
            <div style={dataRow}>
              <span style={dataLabel}>SHARK COINS ASIGNADAS:</span>
              <span style={dataValueGold}>100.00 SC</span>
            </div>
            
            <div style={dataRow}>
              <span style={dataLabel}>RANKING ELO:</span>
              <span style={dataValue}>PENDIENTE DE CALIBRACIÓN</span>
            </div>
            
            <div style={dataRow}>
              <span style={dataLabel}>ESTADO DE CUENTA:</span>
              <span style={dataValueAlert}>REQUIERE VERIFICACIÓN</span>
            </div>
          </Section>

          <Text style={paragraph}>
            Para desplegar tu cuenta, compilar tu panel de métricas y liberar los fondos iniciales, requieres autenticar tu punto de acceso. Este enlace seguro expira en 24 horas.
          </Text>

          {/* Botón CTA (Call to Action) */}
          <Section style={btnContainer}>
            <Button style={button} href={verificationLink}>
              VERIFICAR Y RECLAMAR FONDOS
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            Si no solicitaste este registro, ignora este mensaje. El sistema purgará esta solicitud automáticamente por seguridad.
          </Text>
          <Text style={footerLog}>
            // SYS_LOG: SECURE_AUTH_REQ // SHARKANIA_CORE_V1 //
          </Text>

        </Container>
      </Body>
    </Html>
  );
};

export default WelcomeVerificationEmail;

// --- ESTILOS INLINE (Módelo Terminal Financiero) ---
const main = {
  backgroundColor: '#0a0a0a', // Fondo casi negro
  fontFamily: 'SFProDisplay-Regular, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  padding: '40px 0',
};

const container = {
  backgroundColor: '#111111',
  border: '1px solid #262626',
  borderRadius: '8px',
  margin: '0 auto',
  padding: '40px',
  maxWidth: '600px',
};

const header = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '40px',
  borderBottom: '1px solid #262626',
  paddingBottom: '20px',
};

const brand = {
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: 'bold',
  letterSpacing: '2px',
  margin: '0',
};

const badge = {
  color: '#38bdf8', // Acento azul cian técnico
  fontSize: '10px',
  fontWeight: 'bold',
  letterSpacing: '1px',
  border: '1px solid #0369a1',
  padding: '4px 8px',
  borderRadius: '4px',
  margin: '0',
};

const heading = {
  color: '#f8fafc',
  fontSize: '24px',
  fontWeight: '700',
  letterSpacing: '-0.5px',
  marginBottom: '24px',
};

const paragraph = {
  color: '#94a3b8', // Gris técnico
  fontSize: '15px',
  lineHeight: '24px',
  marginBottom: '20px',
};

const highlight = {
  color: '#f8fafc',
};

const dataBox = {
  backgroundColor: '#000000',
  border: '1px solid #262626',
  borderRadius: '6px',
  padding: '24px',
  marginBottom: '24px',
};

const dataBoxTitle = {
  color: '#64748b',
  fontSize: '11px',
  fontWeight: 'bold',
  letterSpacing: '1.5px',
  marginBottom: '16px',
  marginTop: '0',
};

const dataRow = {
  marginBottom: '8px',
  fontSize: '13px',
  fontFamily: 'monospace',
};

const dataLabel = {
  color: '#64748b',
  display: 'inline-block',
  width: '180px',
};

const dataValue = {
  color: '#cbd5e1',
};

const dataValueGold = {
  color: '#fbbf24', // Dorado
  fontWeight: 'bold',
};

const dataValueAlert = {
  color: '#ef4444', // Rojo sutil
};

const btnContainer = {
  textAlign: 'center' as const,
  marginTop: '32px',
  marginBottom: '32px',
};

const button = {
  backgroundColor: '#f8fafc', // Botón blanco de alto contraste
  color: '#0a0a0a',
  fontSize: '13px',
  fontWeight: 'bold',
  letterSpacing: '1px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '14px 24px',
  borderRadius: '4px',
};

const hr = {
  borderColor: '#262626',
  margin: '32px 0',
};

const footer = {
  color: '#475569',
  fontSize: '12px',
  lineHeight: '18px',
};

const footerLog = {
  color: '#334155',
  fontSize: '10px',
  fontFamily: 'monospace',
  marginTop: '16px',
};