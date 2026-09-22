-- Place the guides that already exist into the area that matches their path.
UPDATE "FeatureInstruction"
SET category = 'GIORNATA'
WHERE "pathPattern" = '/dashboard/*' AND category = 'GENERALE';

UPDATE "FeatureInstruction"
SET category = 'FINANZA'
WHERE "pathPattern" = '/finanza/pagamenti/*' AND category = 'GENERALE';

-- Daily workflows. Fixed ids so a second run of this file cannot duplicate them.
INSERT INTO "FeatureInstruction" (
  id, "pathPattern", role, title, description, category, "sortOrder", "isActive", "createdAt", "updatedAt"
) VALUES
(
  'guide-nuovo-paziente',
  '/pazienti/nuovo',
  NULL,
  'Registrare un nuovo paziente',
  'Cosa compilare nella scheda nuova prima di salvare.',
  'PAZIENTI',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-cerca-paziente',
  '/pazienti/lista',
  NULL,
  'Cercare un paziente',
  'Trova una scheda già presente e aprile.',
  'PAZIENTI',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-richiamo-coda',
  '/richiami/programmati',
  NULL,
  'Inviare un richiamo in coda',
  'Manda il messaggio WhatsApp di un richiamo ancora in attesa.',
  'RICHIAMI',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-invio-non-riuscito',
  '/richiami/programmati/non-inviati',
  NULL,
  'Sistemare un invio non riuscito',
  'Il richiamo non è partito: controlla il contatto e chiudi l''avviso.',
  'RICHIAMI',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-movimento-magazzino',
  '/magazzino/movimenti',
  NULL,
  'Registrare un movimento di magazzino',
  'Carico o scarico di un prodotto già in elenco.',
  'MAGAZZINO',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO "FeatureInstructionStep" (
  id, "instructionId", title, content, "sortOrder", "createdAt", "updatedAt"
) VALUES
(
  'guide-nuovo-paziente-1',
  'guide-nuovo-paziente',
  'Compila i campi in rosso',
  '**Cognome**, **Nome** e **Telefono** sono obbligatori. Indirizzo, città, email e foto si possono lasciare vuoti.',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-nuovo-paziente-2',
  'guide-nuovo-paziente',
  'Codice fiscale',
  'Se lo hai, scrivilo in **Codice Fiscale**. La **Data di Nascita** si compila a parte.',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-nuovo-paziente-3',
  'guide-nuovo-paziente',
  'Anamnesi',
  'In **Anamnesi Generale** segna solo le condizioni che il paziente conferma.',
  2,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-nuovo-paziente-4',
  'guide-nuovo-paziente',
  'Consenso',
  'In **Consenso e firma digitale** leggi l''informativa e raccogli la firma. Se il consenso è già su carta, usa la casella del consenso cartaceo.',
  3,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-nuovo-paziente-5',
  'guide-nuovo-paziente',
  'Salva la scheda',
  'Premi **Aggiungi nuovo paziente**. **Annulla** torna indietro senza salvare.',
  4,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-cerca-paziente-1',
  'guide-cerca-paziente',
  'Cerca',
  'Nel campo **Cerca** scrivi nome, cognome, email o telefono.',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-cerca-paziente-2',
  'guide-cerca-paziente',
  'Applica',
  'Premi **Applica**. **Mostra tutto** toglie il filtro e rivedi l''elenco intero.',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-cerca-paziente-3',
  'guide-cerca-paziente',
  'Apri la scheda',
  'Clicca il nome del paziente nella lista per aprire la scheda.',
  2,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-richiamo-coda-1',
  'guide-richiamo-coda',
  'Trova il richiamo',
  'In **Richiami in scadenza** cerca il paziente. La scritta **In ritardo** indica un invio già oltre la data.',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-richiamo-coda-2',
  'guide-richiamo-coda',
  'Invia',
  'Premi **Invia** per aprire WhatsApp con il testo del richiamo. Se il pulsante è spento, al paziente manca un telefono usabile.',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-richiamo-coda-3',
  'guide-richiamo-coda',
  'Scheda o rimozione',
  '**Scheda** apre il paziente. **Rimuovi** toglie questo richiamo dalla coda.',
  2,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-invio-non-riuscito-1',
  'guide-invio-non-riuscito',
  'Leggi il motivo',
  'Ogni riga dice perché l''invio non è partito e quale contatto manca.',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-invio-non-riuscito-2',
  'guide-invio-non-riuscito',
  'Apri la scheda',
  'Premi **Scheda paziente** e completa telefono o email.',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-invio-non-riuscito-3',
  'guide-invio-non-riuscito',
  'Chiudi l''avviso',
  'Quando il contatto è a posto, premi **Chiudi** per togliere la riga da questo elenco. Poi torna ai richiami in scadenza.',
  2,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-movimento-magazzino-1',
  'guide-movimento-magazzino',
  'Scegli il prodotto',
  'Nel riquadro **Movimenti** apri **Seleziona prodotto** e scegli un articolo già presente.',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-movimento-magazzino-2',
  'guide-movimento-magazzino',
  'Quantità e verso',
  'Scrivi la **Quantità**. **Carico** aumenta la giacenza, **Scarico** la diminuisce. La nota è facoltativa.',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-movimento-magazzino-3',
  'guide-movimento-magazzino',
  'Registra',
  'Premi **Registra movimento**. Il movimento compare nell''elenco sotto.',
  2,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
