# Richiami e Comunicazioni Ricorrenti

La sezione **Richiami** ti permette di automatizzare i promemoria legati alle visite e di gestire comunicazioni periodiche verso tutti i pazienti.

---

## Richiami automatici (visite)

Le regole di richiamo si basano sull'**ultima visita completata** per il servizio scelto.  
Quando l'intervallo impostato scatta, il richiamo entra nella lista “Richiami in scadenza”.

Esempio:  
*Servizio “Igiene” ogni 180 giorni* → la lista si popola 180 giorni dopo l’ultima igiene completata.

---

## Comunicazioni ricorrenti (email)

Queste email sono inviate **a tutti i pazienti con email valida** e non dipendono dalle visite.
Le comunicazioni partono alle **09:00** del giorno previsto.

Sono previste tre tipologie:
1. **Festività italiane**
2. **Chiusure studio** (inviate X giorni prima della chiusura impostata; predefinito **7 giorni**)
3. **Compleanni**

---

## Promemoria appuntamenti

Per inviare promemoria automatici prima degli appuntamenti:
1. Vai in **Richiami → Regole automatiche**.
2. Nella sezione **Promemoria appuntamenti**, attiva **Attivo**.
3. Imposta **Invia (giorni prima)** a `1` per il promemoria 24 ore prima.
4. Seleziona il **Canale** (Email o Email + SMS).
5. Salva con **Salva promemoria appuntamenti**.

Il promemoria viene inviato solo se l'appuntamento è programmato e l'indirizzo email del paziente è presente.

---

## Festività coperte

Le festività incluse nell'invio automatico sono:
- Capodanno (1 gennaio)
- Epifania (6 gennaio)
- Pasqua (data variabile)
- Pasquetta (lunedì dopo Pasqua)
- Festa della Liberazione (25 aprile)
- Festa del Lavoro (1 maggio)
- Festa della Repubblica (2 giugno)
- Ferragosto (15 agosto)
- Ognissanti (1 novembre)
- Immacolata Concezione (8 dicembre)
- Natale (25 dicembre)
- Santo Stefano (26 dicembre)

Pasqua e Pasquetta vengono calcolate automaticamente ogni anno.
