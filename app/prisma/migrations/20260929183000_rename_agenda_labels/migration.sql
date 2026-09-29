UPDATE "FeatureInstructionStep"
SET content = 'Apri **ELENCO APPUNTAMENTI** per aggiornare stato e promemoria.',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE id = 'guide-agenda-home-1';

UPDATE "FeatureInstructionStep"
SET content = 'Apri **CALENDARIO APPUNTAMENTI** per scegliere un orario libero e creare un appuntamento.',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE id = 'guide-agenda-home-2';
