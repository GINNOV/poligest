# Amministrazione e Configurazione del Sistema

L'area **Amministrazione** è il centro di controllo di SORRIDI ed è accessibile esclusivamente agli utenti con ruolo di **Amministratore**. Da qui è possibile plasmare il comportamento del software per adattarlo alle esigenze specifiche dello studio Agovino & Angrisano, gestendo le identità digitali del personale, il listino delle prestazioni sanitarie e i protocolli di sicurezza e backup dei dati.

## Gestione dello Staff e degli Utenti

La sicurezza dello studio inizia dalla corretta gestione degli account. Nella sezione Amministrazione, puoi creare nuovi profili per medici, assistenti e personale di segreteria. Per ogni nuovo utente, dovrai inserire un indirizzo email valido (che servirà come nome utente) e assegnare uno dei ruoli predefiniti descritti nella guida all'accesso. È possibile disattivare temporaneamente un account senza cancellarne i dati storici: questa funzione è utile per collaboratori occasionali o in caso di cessazione del rapporto lavorativo, garantendo che nessuno possa accedere al sistema pur mantenendo l'integrità dei log di audit.

---

## Configurazione del Listino Servizi

Il **Catalogo Servizi** è l'elenco delle prestazioni che lo studio offre ai pazienti. È fondamentale mantenere questo catalogo aggiornato poiché alimenta i menu a tendina nell'Agenda e nel modulo Finanza. Per ogni servizio (ad esempio "Igiene Professionale", "Estrazione Semplice", "Sbiancamento"), puoi definire un nome descrittivo e un costo base. Il sistema permette anche di impostare una durata stimata per ogni prestazione: questa informazione viene utilizzata dall'agenda per calcolare automaticamente lo spazio necessario sul calendario quando prenoti un appuntamento, riducendo drasticamente il rischio di errori di pianificazione.

---

## Monitoraggio e Audit Log

In conformità con le normative sulla protezione dei dati, SORRIDI registra ogni operazione sensibile effettuata all'interno della piattaforma. L'**Audit Log** è un registro consultabile solo dagli Admin che elenca, in ordine cronologico, chi ha effettuato l'accesso, quali schede paziente sono state visualizzate, quali appuntamenti sono stati cancellati e quali transazioni finanziarie sono state modificate. Questo strumento è essenziale per la trasparenza interna e per risolvere eventuali discrepanze nei dati: se un'informazione sembra errata o mancante, l'Audit Log permette di risalire all'istante esatto della modifica e all'utente che l'ha effettuata.

---

## Sicurezza e Backup dei Dati

Sebbene la piattaforma sia ospitata su infrastrutture sicure e ridondate, è responsabilità dell'amministratore garantire la disponibilità di copie di sicurezza locali. Nella sezione **Gestione Dati**, troverai gli strumenti per:
*   **Esportazione (Backup):** Questa funzione genera un file completo contenente l'intero database dello studio (anagrafiche, diari clinici, agenda e finanza). Ti consigliamo di eseguire questa operazione regolarmente (almeno una volta a settimana) e di conservare il file in un supporto esterno protetto.
*   **Importazione (Ripristino):** Questa è un'operazione critica che permette di ricaricare i dati da un backup precedente. **Attenzione:** il ripristino sovrascrive completamente i dati attuali. Questa funzione deve essere utilizzata solo in casi di emergenza estrema e, preferibilmente, sotto la supervisione del supporto tecnico per evitare la perdita accidentale di inserimenti recenti.
