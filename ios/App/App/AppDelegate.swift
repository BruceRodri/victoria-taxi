import UserNotifications
import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let en = Locale.preferredLanguages.first?.hasPrefix("en") == true
        let answer = UNNotificationAction(identifier: "answer", title: en ? "Answer" : "Contestar", options: [.foreground])
        let decline = UNNotificationAction(identifier: "decline", title: en ? "Decline" : "Rechazar", options: [.foreground, .destructive])
        let category = UNNotificationCategory(identifier: "VT_CALL", actions: [answer, decline], intentIdentifiers: [], options: [])
        let outside = UNNotificationAction(identifier: "outside", title: en ? "I'm outside" : "Ya estoy afuera", options: [.foreground])
        let coming = UNNotificationAction(identifier: "coming", title: en ? "I'm coming out" : "Estoy saliendo", options: [.foreground])
        let arrival = UNNotificationCategory(identifier: "VT_ARRIVAL", actions: [outside, coming], intentIdentifiers: [], options: [])
        UNUserNotificationCenter.current().setNotificationCategories([category, arrival])
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
import AVFoundation
import AudioToolbox

class RideBridgeController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(RideAudioPlugin())
    }
}

@objc(RideAudioPlugin)
class RideAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "RideAudioPlugin"
    let jsName = "RideAudio"
    let pluginMethods: [CAPPluginMethod] = ["ring", "route", "end"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private var timer: Timer?
    private var active = false
    @objc func ring(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.timer?.invalidate()
            if call.getBool("on") == true {
                AudioServicesPlayAlertSound(1005)
                self.timer = Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { _ in AudioServicesPlayAlertSound(1005) }
            }
            call.resolve()
        }
    }
    @objc func route(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()
        let choice = call.getString("route") ?? "earpiece"
        do {
            try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth])
            try session.setActive(true)
            active = true
            let type: AVAudioSession.Port = choice == "bluetooth" ? .bluetoothHFP : .builtInMic
            guard let input = session.availableInputs?.first(where: { $0.portType == type }) else { call.reject("Audio device unavailable"); return }
            try session.setPreferredInput(input)
            try session.overrideOutputAudioPort(choice == "speaker" ? .speaker : .none)
            call.resolve()
        } catch { call.reject(error.localizedDescription) }
    }
    @objc func end(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.timer?.invalidate()
            if self.active { try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation); self.active = false }
            call.resolve()
        }
    }
}
