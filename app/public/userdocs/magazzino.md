# Magazzino e Scorte

La gestione del **Magazzino** permette di tracciare i consumi dei materiali, gestire gli ordini ai fornitori e mantenere la tracciabilità dei dispositivi medici (impianti).

## Prodotti e Listini
In questa sezione trovi l'elenco di tutti i materiali gestiti.
-   **Anagrafica Prodotto:** Nome, Codice (SKU), Fornitore, Costo unitario.
-   **Soglia Minima:** Puoi impostare una quantità minima sotto la quale il prodotto viene segnalato come "in esaurimento".

## Movimenti di Magazzino

Ogni variazione delle scorte viene registrata come movimento.

### Carico (Entrata)
Registra i nuovi arrivi di merce.
-   Seleziona il prodotto.
-   Inserisci la quantità arrivata.
-   (Opzionale) Aggiungi note o riferimenti alla bolla di consegna.

### Scarico (Uscita)
Registra il consumo di materiale.
-   Può essere associato a un paziente specifico (utile per la fatturazione o tracciabilità).

## Registro Impianti (Tracciabilità UDI)

Per i dispositivi medici impiantabili (es. impianti dentali), il sistema offre una tracciabilità avanzata conforme alle normative.
Durante lo scarico di un impianto, è possibile (e raccomandato) inserire:
-   **UDI-DI:** Identificativo del dispositivo.
-   **UDI-PI:** Identificativo di produzione (Lotto, Scadenza, Seriale).
-   **Dati Intervento:** Data, sito dell'intervento e paziente associato.

## Guide Pratiche: Come fare per...

### Aggiungere un nuovo materiale (Prodotto)
1.  Entra nella sezione **Magazzino**.
2.  Assicurati di essere nella scheda **Prodotti**.
3.  Clicca su **"Nuovo Prodotto"**.
4.  **Dettagli:** Inserisci il nome del materiale, il codice (SKU) se disponibile, e seleziona il **Fornitore**.
5.  **Soglia di Riordino:** Imposta la quantità minima (es. "5") sotto la quale vuoi ricevere un avviso di scorta bassa.
6.  Salva. *Nota: Una volta creato il prodotto, dovrai fare un movimento di "Carico" per impostare la giacenza iniziale.*

### Aggiungere un nuovo fornitore
1.  In **Magazzino**, vai alla scheda **Fornitori**.
2.  Clicca su **"Aggiungi Fornitore"**.
3.  Inserisci Ragione Sociale, Email e Telefono per poterli contattare rapidamente in caso di ordini.
4.  Salva.

### Registrare il carico di merce (Arrivo ordine)
1.  In **Magazzino**, clicca su **"Nuovo Movimento"** o cerca il prodotto specifico.
2.  Scegli il tipo **"Carico (Entrata)"**.
3.  Inserisci la quantità ricevuta.
4.  Se si tratta di un impianto, inserisci i dati di tracciabilità (Lotto e Scadenza) nel campo apposito.
5.  Conferma.
