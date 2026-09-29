-- Rewrite the three personal notes into desk checklists, and add the
-- missing daily guides. One guide per path: an existing row is updated
-- in place so a second guide cannot hide it. A fresh database gets the
-- row only when that path is still empty.

INSERT INTO "FeatureInstruction" (
  id, "pathPattern", role, title, description, category, "sortOrder", "isActive", "createdAt", "updatedAt"
)
SELECT
  seed.id,
  seed."pathPattern",
  NULL,
  seed.title,
  seed.description,
  seed.category,
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  VALUES
    ('guide-giornata'::text, '/dashboard/*'::text, 'Seguire la giornata'::text, 'Aggiorna lo stato della visita, manda il promemoria e apri il calendario.'::text, 'GIORNATA'::text),
    ('guide-calendario'::text, '/calendar/*'::text, 'Creare un appuntamento'::text, 'Prenota dal calendario del medico.'::text, 'AGENDA'::text),
    ('guide-incasso'::text, '/finanza/pagamenti/*'::text, 'Registrare un incasso'::text, 'Controlla il preventivo, il residuo e registra il pagamento.'::text, 'FINANZA'::text)
) AS seed(id, "pathPattern", title, description, category)
WHERE NOT EXISTS (
  SELECT 1 FROM "FeatureInstruction" existing
  WHERE existing."pathPattern" = seed."pathPattern"
);

UPDATE "FeatureInstruction"
SET
  title = 'Seguire la giornata',
  description = 'Aggiorna lo stato della visita, manda il promemoria e apri il calendario.',
  category = 'GIORNATA',
  role = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "pathPattern" = '/dashboard/*';

UPDATE "FeatureInstruction"
SET
  title = 'Creare un appuntamento',
  description = 'Prenota dal calendario del medico.',
  category = 'AGENDA',
  role = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "pathPattern" = '/calendar/*';

UPDATE "FeatureInstruction"
SET
  title = 'Registrare un incasso',
  description = 'Controlla il preventivo, il residuo e registra il pagamento.',
  category = 'FINANZA',
  role = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "pathPattern" = '/finanza/pagamenti/*';

DELETE FROM "FeatureInstructionStep"
WHERE "instructionId" IN (
  SELECT id FROM "FeatureInstruction"
  WHERE "pathPattern" IN ('/dashboard/*', '/calendar/*', '/finanza/pagamenti/*')
);

INSERT INTO "FeatureInstructionStep" (
  id, "instructionId", title, content, "sortOrder", "createdAt", "updatedAt"
)
SELECT
  step.id,
  guide.id,
  step.title,
  step.content,
  step."sortOrder",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "FeatureInstruction" AS guide
JOIN (
  VALUES
    ('/dashboard/*', 'guide-giornata-1', 'Promemoria', 'Premi **Promemoria** sulla riga dell''appuntamento per mandare il messaggio al paziente.', 0),
    ('/dashboard/*', 'guide-giornata-2', 'Stato della visita', 'Apri il menu dello stato. **Confermato** se ha risposto, **In attesa** se è arrivato, **In corso** se è entrato, **Completato** a fine visita. **No-show** se non si presenta, **Annullato** se l''appuntamento salta.', 1),
    ('/dashboard/*', 'guide-giornata-3', 'Modifica', 'Premi **Calendario** oppure **MODIFICA / CALENDARIO** per aprire l''appuntamento e cambiarlo.', 2),
    ('/calendar/*', 'guide-calendario-1', 'Apri l''orario', 'Scegli il giorno. Nella vista giorno premi **+ Aggiungi appuntamento** sull''ora libera. In settimana o mese apri **Nuovo appuntamento**.', 0),
    ('/calendar/*', 'guide-calendario-2', 'Paziente e visita', 'In **Paziente** cerca la scheda. Compila **Tipo di appuntamento**, **Servizio** e **Medico assegnato**. Le note sono facoltative.', 1),
    ('/calendar/*', 'guide-calendario-3', 'Paziente nuovo', 'Se non è in elenco, crealo dalla stessa ricerca. Servono **Nome**, **Cognome**, **Telefono** e **Data di Nascita**. Email e codice fiscale si possono lasciare vuoti.', 2),
    ('/calendar/*', 'guide-calendario-4', 'Salva', 'Premi **Aggiungi appuntamento**. Se compare un avviso di chiusura, ferie o fuori disponibilità, cambia orario o medico, oppure conferma se la prenotazione è voluta.', 3),
    ('/finanza/pagamenti/*', 'guide-incasso-1', 'Cerca il paziente', 'Nel campo **Cerca per cognome e nome** scegli la scheda.', 0),
    ('/finanza/pagamenti/*', 'guide-incasso-2', 'Preventivo', 'Apri **1 - DETTAGLIO FINANZIARIO**. Controlla le prestazioni e i prezzi. Per aggiungerne una premi **+ Aggiungi prestazione**, poi **AGGIORNA**.', 1),
    ('/finanza/pagamenti/*', 'guide-incasso-3', 'Residuo', 'Apri **2 - PRESTAZIONI NON ANCORA SALDATE** e leggi il **Residuo**. Se non c''è un preventivo, o è tutto saldato, non c''è un incasso da registrare.', 2),
    ('/finanza/pagamenti/*'::text, 'guide-incasso-4'::text, 'Incasso'::text, 'Apri **3 - AGGIUNGI INCASSO**, scegli la prestazione, scrivi l''importo e premi **Registra incasso**.'::text, 3)
) AS step(path, id, title, content, "sortOrder")
  ON step.path = guide."pathPattern";

INSERT INTO "FeatureInstruction" (
  id, "pathPattern", role, title, description, category, "sortOrder", "isActive", "createdAt", "updatedAt"
) VALUES
(
  'guide-agenda-home',
  '/agenda',
  NULL,
  'Scegliere agenda o calendario',
  'Da qui apri gli appuntamenti già fissati oppure il calendario per prenotare.',
  'AGENDA',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-appuntamenti',
  '/agenda/appuntamenti',
  NULL,
  'Aggiornare un appuntamento fissato',
  'Promemoria, stato e modifica di un appuntamento già in elenco.',
  'AGENDA',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-pazienti-home',
  '/pazienti',
  NULL,
  'Scegliere la scheda giusta',
  'Apri un paziente nuovo, uno già presente, i duplicati o i certificati.',
  'PAZIENTI',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-scheda-paziente',
  '/pazienti/*',
  NULL,
  'Lavorare sulla scheda',
  'Contatti, foto, consensi e diario del paziente aperto.',
  'PAZIENTI',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-duplicati',
  '/pazienti/duplicati',
  NULL,
  'Unire schede doppie',
  'Controlla i gruppi e tieni una sola scheda.',
  'PAZIENTI',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-certificati',
  '/pazienti/certificati',
  NULL,
  'Aprire un certificato',
  'Archivio dei certificati medici.',
  'PAZIENTI',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-certificato-nuovo',
  '/pazienti/certificati/nuovo',
  NULL,
  'Emettere un certificato',
  'Compila il certificato e raccogli la firma.',
  'PAZIENTI',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-richiami-home',
  '/richiami',
  NULL,
  'Scegliere il tipo di richiamo',
  'Regole automatiche, coda da inviare o messaggi ricorrenti.',
  'RICHIAMI',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-richiami-regole',
  '/richiami/regole',
  NULL,
  'Creare una regola di richiamo',
  'Richiamo dopo una prestazione, e promemoria prima di una visita.',
  'RICHIAMI',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'guide-richiami-ricorrenti',
  '/richiami/ricorrenti',
  NULL,
  'Festività, chiusure e compleanni',
  'Email automatiche per le ricorrenze dello studio.',
  'RICHIAMI',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO "FeatureInstructionStep" (
  id, "instructionId", title, content, "sortOrder", "createdAt", "updatedAt"
) VALUES
(
  'guide-agenda-home-1',
  'guide-agenda-home',
  'Appuntamenti già fissati',
  'Apri **APPUNTAMENTI ESISTENTI** per aggiornare stato e promemoria.',
  0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-agenda-home-2',
  'guide-agenda-home',
  'Prenotare',
  'Apri **CALENDARIO MEDICI** per scegliere un orario libero e creare un appuntamento.',
  1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-appuntamenti-1',
  'guide-appuntamenti',
  'Promemoria',
  'Premi **Promemoria** sulla riga dell''appuntamento per mandare il messaggio al paziente.',
  0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-appuntamenti-2',
  'guide-appuntamenti',
  'Stato della visita',
  'Apri il menu dello stato. **Confermato** se ha risposto, **In attesa** se è arrivato, **In corso** se è entrato, **Completato** a fine visita. **No-show** se non si presenta, **Annullato** se l''appuntamento salta.',
  1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-appuntamenti-3',
  'guide-appuntamenti',
  'Modifica',
  'Premi **MODIFICA / CALENDARIO** per aprire l''appuntamento e cambiarlo.',
  2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-pazienti-home-1',
  'guide-pazienti-home',
  'Nuovo paziente',
  'Apri **Nuovo paziente** per creare la scheda.',
  0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-pazienti-home-2',
  'guide-pazienti-home',
  'Paziente già presente',
  'Apri **Lista pazienti** e cerca per nome, cognome, email o telefono.',
  1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-pazienti-home-3',
  'guide-pazienti-home',
  'Duplicati e certificati',
  '**Cerca duplicati** unisce schede doppie. **Certificati** apre l''archivio dei certificati medici.',
  2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-scheda-paziente-1',
  'guide-scheda-paziente',
  'Contatti',
  'Nella **Scheda paziente** controlla telefono ed email. Per cambiarli apri la sezione e premi **Aggiorna scheda paziente**.',
  0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-scheda-paziente-2',
  'guide-scheda-paziente',
  'Foto',
  'Premi **Gestisci foto** per caricare un file o scattare con la fotocamera.',
  1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-scheda-paziente-3',
  'guide-scheda-paziente',
  'Consenso',
  'Apri **Consensi & Privacy**, scegli il modulo e premi **Apri informativa e firma**. Per annullarne uno usa **Revoca**.',
  2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-scheda-paziente-4',
  'guide-scheda-paziente',
  'Diario',
  'Nel **Diario clinico** scegli il dente o tutta la bocca, scrivi la prestazione e premi **Salva nel Diario**.',
  3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-duplicati-1',
  'guide-duplicati',
  'Cerca',
  'Premi **Cerca** per vedere i gruppi di schede simili.',
  0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-duplicati-2',
  'guide-duplicati',
  'Unisci',
  'Sulla scheda da tenere premi **Unisci in questa scheda**. Se i gruppi sono sicuri, **Unisci tutti i gruppi sicuri** li unisce insieme.',
  1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-certificati-1',
  'guide-certificati',
  'Nuovo',
  'Premi **Nuovo Certificato** per emetterne uno.',
  0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-certificati-2',
  'guide-certificati',
  'Archivio',
  'Nella tabella apri un certificato già emesso per ristamparlo o farne una nuova versione.',
  1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-certificato-nuovo-1',
  'guide-certificato-nuovo',
  'Compila e firma',
  'Compila il certificato e raccogli la **Firma Digitale Medico / Struttura**.',
  0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-certificato-nuovo-2',
  'guide-certificato-nuovo',
  'Emetti',
  'Premi **Emetti Certificato Ufficiale**. Se stai aggiornando un certificato già emesso, il pulsante è **Salva Nuova Versione**.',
  1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-richiami-home-1',
  'guide-richiami-home',
  'Dopo una prestazione',
  'Apri **Regole automatiche** per far partire un richiamo da solo, dopo il servizio scelto.',
  0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-richiami-home-2',
  'guide-richiami-home',
  'Coda da inviare',
  'Apri **Richiami in coda** per mandare un richiamo in attesa o sistemare un invio non riuscito.',
  1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-richiami-home-3',
  'guide-richiami-home',
  'Ricorrenze',
  'Apri **Comunicazioni ricorrenti** per festività, chiusure dello studio e compleanni.',
  2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-richiami-regole-1',
  'guide-richiami-regole',
  'Nuova regola',
  'Compila **Nome regola**, **Servizio**, **Intervallo (giorni)** e **Canale**. Il template può restare **Messaggio predefinito**.',
  0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-richiami-regole-2',
  'guide-richiami-regole',
  'Salva',
  'Premi **Crea regola automatica**.',
  1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-richiami-regole-3',
  'guide-richiami-regole',
  'Promemoria delle visite',
  'In **Promemoria appuntamenti** spunta **Attiva regola**, scegli quando inviare e premi **Aggiorna regola**.',
  2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-richiami-ricorrenti-1',
  'guide-richiami-ricorrenti',
  'Scegli il tipo',
  'Apri **Festivita italiane**, **Chiusure studio** o **Compleanni**.',
  0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-richiami-ricorrenti-2',
  'guide-richiami-ricorrenti',
  'Testo',
  'Spunta **Attivo** e controlla **Oggetto email** e **Messaggio**. Per le chiusure imposta **Invia (giorni prima)**.',
  1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'guide-richiami-ricorrenti-3',
  'guide-richiami-ricorrenti',
  'Salva',
  'Premi **Aggiorna impostazioni**. L''email parte solo per i pazienti che hanno un indirizzo valido.',
  2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);
