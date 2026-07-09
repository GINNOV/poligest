import WatchConnectivity
import Combine
import Foundation

class WatchConnectivityManager: NSObject, WCSessionDelegate, ObservableObject {
    static let shared = WatchConnectivityManager()
    
    @Published var todayTransactions: [Transaction] = []
    
    override init() {
        super.init()
        #if targetEnvironment(macCatalyst)
        return
        #endif
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
        }
    }
    
    func sendTransactionsToWatch(_ transactions: [Transaction]) {
        #if targetEnvironment(macCatalyst)
        return
        #endif
        guard WCSession.isSupported() else { return }
        
        let calendar = Calendar.current
        let todayTxs = transactions.filter { calendar.isDateInToday($0.date) }
        
        do {
            let data = try JSONEncoder().encode(todayTxs)
            let context = ["todayTransactions": data]
            
            // Only update if activated, otherwise it will fail
            if WCSession.default.activationState == .activated {
                try WCSession.default.updateApplicationContext(context)
            }
        } catch {
            print("Failed to update Watch context: \(error.localizedDescription)")
        }
    }
    
    // MARK: - WCSessionDelegate
    
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        #if !os(iOS)
        if activationState == .activated {
            DispatchQueue.main.async {
                self.loadFromReceivedContext(session.receivedApplicationContext)
            }
        }
        #endif
    }
    
    #if os(iOS)
    func sessionDidBecomeInactive(_ session: WCSession) {}
    
    func sessionDidDeactivate(_ session: WCSession) {
        WCSession.default.activate()
    }
    #endif
    
    #if !os(iOS)
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        DispatchQueue.main.async {
            self.loadFromReceivedContext(applicationContext)
        }
    }
    
    private func loadFromReceivedContext(_ context: [String: Any]) {
        guard let data = context["todayTransactions"] as? Data else { return }
        do {
            let txs = try JSONDecoder().decode([Transaction].self, from: data)
            self.todayTransactions = txs
            UserDefaults.standard.set(data, forKey: "cachedTodayTransactions")
        } catch {
            print("Failed to decode transactions on Watch: \(error.localizedDescription)")
        }
    }
    
    func loadCachedTransactions() {
        if let data = UserDefaults.standard.data(forKey: "cachedTodayTransactions") {
            do {
                self.todayTransactions = try JSONDecoder().decode([Transaction].self, from: data)
            } catch {}
        }
    }
    #endif
}
