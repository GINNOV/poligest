# Amministrazione del Sistema

L'area **Amministrazione** è riservata agli utenti con ruolo **Admin**. Da qui si configura l'intero funzionamento della piattaforma SORRIDI.

## Gestione Utenti e Ruoli
Qui puoi creare nuovi account per lo staff e i medici o disabilitare quelli non più necessari.
-   **Creazione:** Inserisci nome, email e ruolo iniziale.
-   **Ruoli:** Assegna o modifica i permessi (es. promuovere una Segretaria a Manager).
-   **Reset Password:** Se un utente perde l'accesso, puoi impostare una nuova password temporanea.

## Catalogo Servizi
Definisce l'elenco delle prestazioni che lo studio offre.
-   **Nome e Descrizione:** Come appare in fattura o nell'agenda.
-   **Costo Base:** Il prezzo di listino standard (che può essere poi variato nel singolo appuntamento).

## Configurazione Accessi
Una funzionalità avanzata che permette di decidere **chi vede cosa**.
Puoi attivare o disattivare interi moduli (es. Magazzino, Finanza) per specifici ruoli, personalizzando l'esperienza d'uso e la sicurezza.

## Audit Log (Registro Eventi)
Per motivi di sicurezza e compliance, il sistema registra automaticamente le azioni sensibili.
-   **Cosa viene tracciato:** Accessi, modifiche alle cartelle cliniche, cancellazioni di appuntamenti, modifiche finanziarie.
-   **Consultazione:** Puoi filtrare il registro per utente, data o tipo di azione per ricostruire la storia di un evento.

## Gestione Dati (Backup e Ripristino)

### Esporta (Backup)
Permette di scaricare un file (formato JSON) contenente tutti i dati del database (pazienti, appuntamenti, ecc.). È utile per effettuare backup periodici offline.

### Importa (Ripristino)
Permette di ricaricare i dati da un file di backup precedente.
> **ATTENZIONE:** L'importazione sovrascrive i dati attuali. Usare con estrema cautela.

## Guide Pratiche: Come fare per...

### Creare un nuovo utente di sistema
1.  Vai in **Amministrazione** > **Utenti**.
2.  Clicca su **"Crea o aggiorna utente"**.
3.  Inserisci l'**Email** dell'utente (sarà il suo identificativo di accesso).
4.  Inserisci il **Nome Completo**.
5.  Assegna il **Ruolo** corretto (Admin, Manager, Segreteria o Medico).
6.  Se l'utente è un **Medico**, assicurati di configurare anche il suo profilo nella sezione "Medici" per collegarlo all'agenda.
7.  Salva. L'utente riceverà le istruzioni per impostare la password.

### Eseguire un backup dei dati
1.  In **Amministrazione**, individua la sezione **Gestione Dati**.
2.  Clicca su **"Esporta"**.
3.  Il sistema genererà un file `.json`. Salvalo in un luogo sicuro (es. un disco esterno o un cloud protetto).
4.  Si consiglia di eseguire questa operazione regolarmente (es. ogni settimana).
