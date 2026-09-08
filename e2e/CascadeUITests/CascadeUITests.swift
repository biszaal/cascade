import XCTest

/// UI tests that drive the real Cascade build on a simulator.
///
/// These exist because the two things a browser preview cannot check are taps on a real
/// device and device rotation. They lean on the accessibility labels the app already
/// exposes - the same ones a screen reader reads - so the automation and the
/// accessibility work verify each other.
final class CascadeUITests: XCTestCase {

    private let bundleId = "com.biszaal.cascade"

    private func launchApp() -> XCUIApplication {
        let app = XCUIApplication(bundleIdentifier: bundleId)
        app.launch()
        // The dev build fetches its JS bundle from Metro, so the first screen can take a
        // while to appear.
        XCTAssertTrue(
            app.buttons["Start playing"].waitForExistence(timeout: 90)
                || app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Continue'")).firstMatch
                    .waitForExistence(timeout: 5),
            "Home screen never appeared - is Metro running?"
        )
        return app
    }

    private func enterFirstLevel(_ app: XCUIApplication) {
        let start = app.buttons["Start playing"]
        let cont = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Continue'")).firstMatch
        if start.exists { start.tap() } else { cont.tap() }

        let anyLane = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Lane '")).firstMatch
        XCTAssertTrue(anyLane.waitForExistence(timeout: 30), "Board never appeared")
    }

    private func lane(_ app: XCUIApplication, _ index: Int) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Lane \(index),")).firstMatch
    }

    private func attach(_ name: String) {
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }

    /// Home screen renders and the primary action reaches a board.
    func testA_enterLevel() {
        let app = launchApp()
        attach("home")
        enterFirstLevel(app)
        attach("board")
        // Every lane must describe itself, or the board is unusable with VoiceOver.
        XCTAssertTrue(lane(app, 1).exists, "Lane 1 has no accessibility label")
    }

    /// A real two-tap pour on a real device, verified through the move counter.
    func testB_pourChangesMoveCount() {
        let app = launchApp()
        enterFirstLevel(app)

        // Undo starts disabled; after one legal pour it must become enabled.
        let undo = app.buttons["Undo"]
        XCTAssertTrue(undo.exists, "Undo control missing")
        XCTAssertFalse(undo.isEnabled, "Undo should be disabled before any move")

        // Lift from lane 2 and pour into lane 4, which is empty on level 1.
        lane(app, 2).tap()
        attach("lifted")
        lane(app, 4).tap()
        attach("poured")

        XCTAssertTrue(
            undo.isEnabled,
            "Undo stayed disabled, so the pour did not register as a move"
        )
    }

    /// The orientation contract, which only a device can prove.
    ///
    /// Info.plist allows portrait only on iPhone and all four orientations on iPad. So
    /// asking the device to rotate must relayout the app on a tablet and must NOT on a
    /// phone. Checking the app's own frame is what distinguishes "the app rotated" from
    /// "the device rotated underneath an app that ignored it".
    func testE_orientationContract() {
        let app = launchApp()
        let isPad = UIDevice.current.userInterfaceIdiom == .pad

        XCUIDevice.shared.orientation = .portrait
        let portraitFrame = app.frame
        XCTAssertGreaterThan(portraitFrame.height, portraitFrame.width, "Did not start portrait")

        XCUIDevice.shared.orientation = .landscapeLeft
        // Let the window settle before measuring.
        Thread.sleep(forTimeInterval: 2.0)
        let rotatedFrame = app.frame
        attach(isPad ? "ipad_after_landscape_request" : "iphone_after_landscape_request")

        if isPad {
            XCTAssertGreaterThan(
                rotatedFrame.width, rotatedFrame.height,
                "iPad should rotate to landscape but stayed portrait"
            )
        } else {
            XCTAssertGreaterThan(
                rotatedFrame.height, rotatedFrame.width,
                "iPhone is portrait-locked in Info.plist but rotated anyway"
            )
        }

        XCUIDevice.shared.orientation = .portrait
    }

    /// The daily board has nine lanes, so it exercises the one-row / two-row decision
    /// that a five-lane level cannot. Rotating it is the real test of the layout rule.
    func testD_dailyBoardSurvivesRotation() {
        let app = launchApp()
        app.buttons["Daily challenge"].tap()

        let anyLane = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Lane '")).firstMatch
        XCTAssertTrue(anyLane.waitForExistence(timeout: 30), "Daily board never appeared")

        XCUIDevice.shared.orientation = .portrait
        attach("daily_portrait")

        XCUIDevice.shared.orientation = .landscapeLeft
        _ = anyLane.waitForExistence(timeout: 10)
        attach("daily_landscape")

        // All nine lanes must still be reachable after the relayout.
        for index in 1...9 {
            XCTAssertTrue(lane(app, index).exists, "Lane \(index) missing in landscape")
        }
    }

    /// Rotation: the thing that cannot be checked without a device.
    func testC_rotationRelaysOutTheBoard() {
        let app = launchApp()
        enterFirstLevel(app)

        XCUIDevice.shared.orientation = .portrait
        attach("portrait")

        XCUIDevice.shared.orientation = .landscapeLeft
        // Give the layout a moment to recompute from the new window size.
        _ = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Lane '")).firstMatch
            .waitForExistence(timeout: 10)
        attach("landscape")

        // The board must survive the rotation rather than clipping or emptying out.
        XCTAssertTrue(lane(app, 1).exists, "Lane 1 vanished after rotating to landscape")
        XCTAssertTrue(app.buttons["Restart"].exists, "HUD vanished after rotating to landscape")
    }
}
