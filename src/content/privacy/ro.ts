import { gaps, type PrivacyCopy } from "./types";

/* Written 29.09.2026 without a native reviewer — every line is marked. */
export const privacyRo: PrivacyCopy = {
  meta: {
    title: "Politica de confidențialitate și cookie-uri — SHUR-SHUR", // ждёт проверки носителем
    description: "Ce face SHUR-SHUR cu datele pe care le trimiteți prin site, cine le primește, cât timp le păstrăm și ce drepturi aveți.", // ждёт проверки носителем
  },
  heading: "Politica de confidențialitate și cookie-uri", // ждёт проверки носителем
  updated: "Versiunea din 29.09.2026", // ждёт проверки носителем
  sections: [
    {
      heading: "Cine răspunde de datele dvs.", // ждёт проверки носителем
      paragraphs: [
        `Operator: ${gaps.controller}, ${gaps.registration}, ${gaps.address}. Contact pentru orice întrebare despre datele dvs.: ${gaps.email}.`, // ждёт проверки носителем
        `Reprezentant în Uniunea Europeană (art. 27 GDPR): ${gaps.euRepresentative}.`, // ждёт проверки носителем
      ],
    },
    {
      heading: "Ce colectăm și de ce", // ждёт проверки носителем
      paragraphs: [],
      items: [
        "Formularul de solicitare: numele de utilizator Instagram și contactul dvs. (un messenger sau un număr de telefon), plus limba paginii. Le folosim ca să vă răspundem și să discutăm lucrarea despre care întrebați (art. 6 alin. (1) lit. b) GDPR — demersuri la cererea dvs. înainte de un contract).", // ждёт проверки носителем
        "De unde ați venit: etichetele campaniei din link (utm_*), prima pagină deschisă și site-ul care v-a trimis (doar domeniul). Ele însoțesc solicitarea ca să știm ce campanie a adus-o (art. 6 alin. (1) lit. f) — interesul nostru legitim de a ne evalua publicitatea).", // ждёт проверки носителем
        "Identificatori publicitari (ID-urile de clic Meta și Google, cookie-urile _fbp și _fbc) — DOAR dacă ați apăsat „Permite cookie-urile publicitare” (art. 6 alin. (1) lit. a) — consimțământ).", // ждёт проверки носителем
        "Adresa IP — pentru a limita numărul de solicitări de la aceeași adresă (protecție anti-spam) și în jurnalele tehnice ale furnizorului de găzduire (art. 6 alin. (1) lit. f) — securitate).", // ждёт проверки носителем
      ],
    },
    {
      heading: "Cookie-uri și stocare în browserul dvs.", // ждёт проверки носителем
      paragraphs: [
        "Strict necesare, fără consimțământ: alegerea dvs. privind cookie-urile (localStorage, până o schimbați); sursa vizitei (sessionStorage, se șterge când închideți fila); limba aleasă, dacă ați schimbat-o (cookie și localStorage, 12 luni).", // ждёт проверки носителем
        "Publicitare, doar după „Permite cookie-urile publicitare”: Meta Pixel și cookie-urile sale _fbp și _fbc (până la 90 de zile). Fără consimțământul dvs. pixelul nu se încarcă deloc. Vă puteți retrage consimțământul oricând, cu linkul „Setări cookie” din josul fiecărei pagini.", // ждёт проверки носителем
      ],
    },
    {
      heading: "Cine primește datele", // ждёт проверки носителем
      paragraphs: [],
      items: [
        "Vercel Inc. (SUA) — găzduiește site-ul și procesează solicitarea în drum spre noi.", // ждёт проверки носителем
        "Telegram — messengerul în care echipa noastră primește solicitarea dvs.", // ждёт проверки носителем
        "Hetzner Online GmbH (UE) — găzduiește serverul nostru cu jurnalul solicitărilor.", // ждёт проверки носителем
        "Meta Platforms Ireland Ltd. — doar cu consimțământul dvs. pentru cookie-uri publicitare: evenimentele pixelului și, pentru o solicitare, doar un hash unidirecțional al contactului, niciodată textul lui.", // ждёт проверки носителем
      ],
    },
    {
      heading: "Transferuri în afara Spațiului Economic European", // ждёт проверки носителем
      paragraphs: [
        `Echipa noastră lucrează din Ucraina, iar unii dintre furnizorii de mai sus sunt în afara SEE. Transferuri în Ucraina: ${gaps.transferBasis}. Vercel se bazează pe EU-US Data Privacy Framework și pe clauzele contractuale standard ale Comisiei Europene.`, // ждёт проверки носителем
      ],
    },
    {
      heading: "Cât timp păstrăm datele", // ждёт проверки носителем
      paragraphs: [],
      items: [
        `Solicitările: ${gaps.leadRetention}.`, // ждёт проверки носителем
        "Adresa IP în limitatorul de solicitări: până la 10 minute, doar în memorie.", // ждёт проверки носителем
        "Sursa vizitei în browserul dvs.: până închideți fila.", // ждёт проверки носителем
        "Alegerea dvs. privind cookie-urile: până o schimbați sau ștergeți datele browserului.", // ждёт проверки носителем
        "Cookie-urile publicitare Meta: până la 90 de zile și doar cu consimțământul dvs.", // ждёт проверки носителем
      ],
    },
    {
      heading: "Drepturile dvs.", // ждёт проверки носителем
      paragraphs: [
        `Puteți cere acces la datele dvs., rectificarea sau ștergerea lor, restricționarea prelucrării, o copie într-un format portabil și vă puteți opune prelucrării bazate pe interesul nostru legitim. Consimțământul poate fi retras oricând, fără a afecta ce s-a făcut înainte. Pentru Israel: dreptul de a consulta și de a corecta informațiile despre dvs. (Legea privind protecția vieții private 5741-1981, secțiunile 13–14). Scrieți-ne la ${gaps.email}.`, // ждёт проверки носителем
        "Nu luăm decizii automatizate despre dvs., nu vindem date și nu trimitem mesaje publicitare pe care nu le-ați cerut.", // ждёт проверки носителем
      ],
    },
    {
      heading: "Unde puteți depune o plângere", // ждёт проверки носителем
      paragraphs: [],
      items: [
        "România — ANSPDCP, Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal: www.dataprotection.ro.", // ждёт проверки носителем
        "Israel — Autoritatea pentru Protecția Vieții Private (Privacy Protection Authority): www.gov.il/en/departments/the_privacy_protection_authority.", // ждёт проверки носителем
        "Ucraina — Comisarul pentru drepturile omului al Radei Supreme a Ucrainei: ombudsman.gov.ua.", // ждёт проверки носителем
        "Sau autoritatea de protecție a datelor din țara UE în care locuiți sau lucrați.", // ждёт проверки носителем
      ],
    },
  ],
  back: "Înapoi pe site", // ждёт проверки носителем
};
