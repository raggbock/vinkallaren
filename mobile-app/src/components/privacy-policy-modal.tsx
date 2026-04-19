import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { AnimatedModal } from "./animated-modal";
import { colors } from "../styles/theme";
import type { styles as themeStyles } from "../styles/theme";

type SharedStyles = typeof themeStyles;

export function PrivacyPolicyModal({ visible, styles, onClose }: { visible: boolean; styles: SharedStyles; onClose: () => void }) {
  return (
    <AnimatedModal visible={visible} onClose={onClose}>
      <SafeAreaView style={styles.scannerScreen}>
        <View style={styles.scannerHeader}>
          <View style={styles.flex}>
            <Text style={styles.scannerTitle}>Integritetspolicy</Text>
          </View>
          <Pressable onPress={onClose}>
            <Text style={styles.linkText}>Stäng</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
          <Section title="Vilka vi är">
            <P>Vinkällaren är en app för att hantera din personliga vinsamling. Appen drivs som ett hobbyprojekt och samlar inte in data i kommersiellt syfte.</P>
          </Section>

          <Section title="Vilka uppgifter vi lagrar">
            <P>När du skapar ett konto lagras din e-postadress och de viner du lägger till. All data lagras i Supabase (EU-region) och är kopplad till ditt konto.</P>
            <P>Vi lagrar inga personuppgifter utöver det du själv anger i appen.</P>
          </Section>

          <Section title="Cookies och lokal lagring">
            <P>Appen använder enbart strikt nödvändiga cookies:</P>
            <Bullet text="Autentisering — Supabase sparar en session-token så att du förblir inloggad." />
            <Bullet text="Säkerhet — Cloudflare kan sätta en cookie (__cf_bm) för att skydda mot automatiserad trafik." />
            <P>Vi använder inga spårningscookies. För att förstå om sidan besöks av riktiga människor eller bottar loggar vi anonym besöksstatistik (sidväg, webbläsare, hänvisare, skärmstorlek) utan IP-adress eller cookies. Sessioner räknas per webbläsarflik och försvinner när fliken stängs.</P>
          </Section>

          <Section title="Tredjeparter">
            <P>Appen kommunicerar med följande tjänster:</P>
            <Bullet text="Supabase — databaslagring, autentisering och anonym besöksstatistik" />
            <Bullet text="Cloudflare — webbhosting och DDoS-skydd" />
            <Bullet text="Open Food Facts — produktuppslag via streckkod (ingen personlig data skickas)" />
            <P>Ingen data säljs eller delas med tredjeparter i marknadsföringssyfte.</P>
          </Section>

          <Section title="Dina rättigheter">
            <P>Du har rätt att begära tillgång till, rättelse av eller radering av dina uppgifter. Kontakta oss så hjälper vi dig.</P>
          </Section>

          <Section title="Kontakt">
            <P>Frågor om integritet? Hör av dig till utvecklaren via appen eller GitHub.</P>
          </Section>
        </ScrollView>
      </SafeAreaView>
    </AnimatedModal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.warm, fontSize: 15, fontWeight: "700" }}>{title}</Text>
      {children}
    </View>
  );
}

function P({ children }: { children: string }) {
  return <Text style={{ color: "#d4bfaa", fontSize: 14, lineHeight: 20 }}>{children}</Text>;
}

function Bullet({ text }: { text: string }) {
  return <Text style={{ color: "#d4bfaa", fontSize: 14, lineHeight: 20, paddingLeft: 12 }}>• {text}</Text>;
}
