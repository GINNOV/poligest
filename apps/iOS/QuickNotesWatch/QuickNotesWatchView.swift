import SwiftUI

struct QuickNotesWatchView: View {
    @ObservedObject var manager = WatchConnectivityManager.shared
    
    private var balance: Double {
        income - expense
    }
    
    private var income: Double {
        manager.todayTransactions.filter { $0.type == .income }.reduce(0.0) { $0 + $1.amount }
    }
    
    private var expense: Double {
        manager.todayTransactions.filter { $0.type == .expense }.reduce(0.0) { $0 + $1.amount }
    }
    
    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Saldo Oggi")
                        .font(.footnote)
                        .foregroundColor(.secondary)
                    Text(EuroAmountFormatter.string(balance))
                        .font(.title2.bold())
                        .foregroundColor(balance >= 0 ? .green : .red)
                        .minimumScaleFactor(0.7)
                        .lineLimit(1)
                    
                    HStack {
                        VStack(alignment: .leading) {
                            Text("Entrate")
                                .font(.system(size: 10))
                                .foregroundColor(.secondary)
                            Text(EuroAmountFormatter.string(income))
                                .font(.caption.bold())
                                .foregroundColor(.green)
                                .minimumScaleFactor(0.7)
                                .lineLimit(1)
                        }
                        
                        Spacer()
                        
                        VStack(alignment: .trailing) {
                            Text("Uscite")
                                .font(.system(size: 10))
                                .foregroundColor(.secondary)
                            Text(EuroAmountFormatter.string(expense))
                                .font(.caption.bold())
                                .foregroundColor(.red)
                                .minimumScaleFactor(0.7)
                                .lineLimit(1)
                        }
                    }
                    .padding(.top, 4)
                }
                .padding(.vertical, 6)
            }
            
            Section(header: Text("Movimenti Oggi").foregroundColor(.secondary)) {
                if manager.todayTransactions.isEmpty {
                    Text("Nessun movimento")
                        .font(.footnote)
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 12)
                } else {
                    ForEach(manager.todayTransactions.sorted(by: { $0.date > $1.date })) { tx in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(tx.clientName.isEmpty ? "Cliente generico" : tx.clientName)
                                    .font(.body.bold())
                                    .lineLimit(1)
                                Spacer()
                                Text(EuroAmountFormatter.string(tx.amount, sign: tx.type == .income ? "+" : "-"))
                                    .font(.body.monospacedDigit())
                                    .foregroundColor(tx.type == .income ? .green : .red)
                                    .lineLimit(1)
                            }
                            
                            HStack {
                                Text(tx.date.formatted(.dateTime.hour().minute()))
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                                Spacer()
                                Text(tx.paymentMethod.rawValue)
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
        }
        .onAppear {
            manager.loadCachedTransactions()
        }
    }
}
