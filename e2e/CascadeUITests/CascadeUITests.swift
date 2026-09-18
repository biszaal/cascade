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

    /// One tap-pair moves exactly ONE token and costs exactly ONE move.
    ///
    /// This is the rule the whole scoring model rests on, and it is the one that
    /// regressed before: the board lifted a whole same-coloured run while only a single
    /// token actually travelled.
    func testB_oneTapMovesOneToken() {
        let app = launchApp()
        // Open level 1 directly. "Continue" lands on whatever level saved progress has reached,
        // and the lane 2 -> lane 4 pour below is only legal on level 1's board.
        open(app, "cascade://play/1")
        XCTAssertTrue(lane(app, 1).waitForExistence(timeout: 30), "Level 1 board never appeared")

        // Undo starts disabled; after one legal pour it must become enabled.
        let undo = app.buttons["Undo"]
        XCTAssertTrue(undo.exists, "Undo control missing")
        XCTAssertFalse(undo.isEnabled, "Undo should be disabled before any move")

        // Lift from lane 2 and drop into lane 4, which is empty on level 1.
        lane(app, 2).tap()
        attach("lifted")
        lane(app, 4).tap()
        attach("dropped")

        XCTAssertTrue(
            undo.isEnabled,
            "Undo stayed disabled, so the move did not register"
        )

        // The HUD announces progress for screen readers, which makes it the most direct
        // read of the move count available to a UI test.
        let counter = app.otherElements
            .matching(NSPredicate(format: "label CONTAINS 'par'"))
            .firstMatch
        XCTAssertTrue(counter.waitForExistence(timeout: 5), "Move counter not exposed")
        XCTAssertTrue(
            counter.label.contains("1 move,"),
            "Expected exactly one move after one tap-pair, got: \(counter.label)"
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

    /// Anchors are new this release, and only a device can prove two things a unit test
    /// cannot: that the accessibility label actually calls one out, and that the engine
    /// really refuses to lift a lone anchor - a bug a review caught (a lone anchor could
    /// be lifted in the app) and a fix wave then closed.
    func testF_anchoredLevel() {
        let app = launchApp()

        // Deep links are not gated by progress, so this reaches level 51 (chapter 6
        // "Bedrock", level 1) directly on a fresh install, without navigating the
        // (locked) chapter list.
        app.open(URL(string: "cascade://play/51")!)

        // Opening a custom-scheme URL this way surfaces iOS's own confirmation alert,
        // which lives in Springboard, not in Cascade.
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let openButton = springboard.buttons["Open"]
        if openButton.waitForExistence(timeout: 5) {
            openButton.tap()
        }

        XCTAssertTrue(lane(app, 1).waitForExistence(timeout: 30), "Level 51 board never appeared")

        // Level 51 deals its anchor face-up (assets/levels/chapter-6.json, id 51), so a
        // sighted player can see it is there but not what colour it is - the label has
        // to say the colour, since that is the one fact a screen reader user cannot get
        // any other way.
        let lane1Label = lane(app, 1).label
        XCTAssertTrue(
            lane1Label.contains("anchored at the base"),
            "Lane 1 should announce its anchor, got: \(lane1Label)"
        )
        XCTAssertFalse(
            lane1Label.contains("colour unknown"),
            "Level 51's anchor is dealt face-up, so its colour should be spoken: \(lane1Label)"
        )
        attach("anchored-board")

        // Level 51's lanes, bottom (index 0 - the anchor) to top:
        //   1: Saffron, Saffron, Sky, Vermilion   <- anchored, capacity 4, FULL
        //   2: Emerald, Sky, Saffron, Sky         <- capacity 4, FULL
        //   3: Vermilion, Emerald, Emerald, Vermilion <- capacity 4, FULL
        //   4: Vermilion, Emerald, Saffron, Sky   <- capacity 4, FULL
        //   5, 6: empty
        // Every dealt lane starts full, so lane 1's first two pops (Vermilion, then Sky)
        // have nowhere to go but the two empty lanes - neither of which then matches
        // lane 1's third token (Saffron), and every other lane is still full. So move 3
        // is a detour on lane 2: it pours lane 2's top Sky onto the Sky already sitting
        // in lane 6, which uncovers a Saffron top on lane 2 with a free slot. Move 4
        // pours lane 1's last free token onto that, leaving lane 1 down to its anchor.
        lane(app, 1).tap(); lane(app, 5).tap()  // Vermilion -> empty lane 5
        lane(app, 1).tap(); lane(app, 6).tap()  // Sky -> empty lane 6
        lane(app, 2).tap(); lane(app, 6).tap()  // Sky -> lane 6 (matches), uncovers Saffron on lane 2
        lane(app, 1).tap(); lane(app, 2).tap()  // Saffron -> lane 2 (matches)

        // Guard: if level 51's layout ever changes, this fails loudly here instead of
        // the refusal check below silently testing nothing.
        let excavated = lane(app, 1).label
        XCTAssertTrue(
            excavated.contains("1 of 4"),
            "Expected lane 1 excavated down to just its anchor, got: \(excavated)"
        )
        attach("lone-anchor")

        // The HUD announces progress for screen readers, which makes it the most direct
        // read of the move count available to a UI test (see testB).
        let counter = app.otherElements
            .matching(NSPredicate(format: "label CONTAINS 'par'"))
            .firstMatch
        XCTAssertTrue(counter.waitForExistence(timeout: 5), "Move counter not exposed")
        let movesBefore = counter.label

        // The on-device proof: tapping the lone anchor must refuse the lift outright, not
        // merely fail to complete a move that never should have started.
        lane(app, 1).tap()
        lane(app, 5).tap()

        XCTAssertEqual(
            counter.label, movesBefore,
            "Tapping a lone anchor should refuse the lift, not register a move"
        )
        XCTAssertTrue(
            lane(app, 1).label.contains("1 of 4"),
            "Lane 1 should still hold only its anchor after the refused lift"
        )
    }

    /// Opens a Cascade deep link and accepts iOS's own "Open in Cascade?" alert, which lives in
    /// Springboard rather than the app.
    private func open(_ app: XCUIApplication, _ link: String) {
        app.open(URL(string: link)!)
        let openButton = XCUIApplication(bundleIdentifier: "com.apple.springboard").buttons["Open"]
        if openButton.waitForExistence(timeout: 5) {
            openButton.tap()
        }
    }

    /// Takes a store screenshot free of iOS's "◀ previous app" breadcrumb.
    ///
    /// A screen reached by URL keeps a back-link to whatever opened it in the status bar, which
    /// must never appear in a store screenshot. Sending the app home and bringing it back the
    /// normal way returns to the same screen with the breadcrumb gone.
    private func storeShot(_ app: XCUIApplication, _ name: String, ready: XCUIElement) {
        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertTrue(
            app.wait(for: .runningForeground, timeout: 10),
            "\(name): the app never came back to the foreground"
        )
        // activate() returns while SpringBoard is still animating the app open, so a shot taken
        // straight away captures the home screen. Wait until this screen's own element can
        // actually be tapped, then let the zoom-in finish.
        let hittable = expectation(for: NSPredicate(format: "isHittable == true"), evaluatedWith: ready)
        wait(for: [hittable], timeout: 15)
        Thread.sleep(forTimeInterval: 1.5)
        attach(name)
    }

    /// The App Store screenshot tour, and a release check that holds whether or not a backend is
    /// configured.
    ///
    /// Run it against a Release build so the shots carry no developer tooling. Whether a backend is
    /// configured is read from Settings' sync control (the daily leaderboard only appears once the
    /// daily board is solved), and no screen ever shows backend setup text.
    func testG_storeTour() {
        XCUIDevice.shared.orientation = .portrait
        let app = launchApp()
        storeShot(
            app, "store-01-home",
            ready: app.buttons.matching(NSPredicate(format: "label == 'Start playing' OR label BEGINSWITH 'Continue'")).firstMatch
        )

        // Boards chosen to show each idea on its own and then together: plain sorting,
        // face-down tokens, anchors, and anchors under fog.
        let boards: [(link: String, name: String)] = [
            ("cascade://play/14", "store-02-sorting"),
            ("cascade://play/38", "store-03-face-down"),
            ("cascade://play/59", "store-04-anchors"),
            ("cascade://play/83", "store-05-anchors-and-fog"),
        ]
        for board in boards {
            open(app, board.link)
            XCTAssertTrue(lane(app, 1).waitForExistence(timeout: 30), "\(board.link) never showed a board")
            XCTAssertTrue(lane(app, 1).exists, "\(board.link) lost its board")
            storeShot(app, board.name, ready: lane(app, 1))
        }

        open(app, "cascade://chapters")
        XCTAssertTrue(
            app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Spring'")).firstMatch
                .waitForExistence(timeout: 15),
            "Chapter list never appeared"
        )
        storeShot(
            app, "store-06-chapters",
            ready: app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Spring'")).firstMatch
        )

        // Twenty chapters now. The pack list in src/data/levels.ts is written out by hand
        // because Metro needs literal require paths, so a chapter can be added to assets and
        // silently never loaded. Scrolling to the last one is the cheapest guard against that.
        app.swipeUp()
        app.swipeUp()
        XCTAssertTrue(
            app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Zenith'")).firstMatch
                .waitForExistence(timeout: 10),
            "Chapter list never reached Zenith - a level pack is missing from src/data/levels.ts"
        )

        open(app, "cascade://daily")
        XCTAssertTrue(lane(app, 1).waitForExistence(timeout: 30), "Daily board never appeared")
        XCTAssertEqual(
            app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'supabase'")).count, 0,
            "Players must never be shown backend setup text"
        )
        attach("verify-daily")

        open(app, "cascade://settings")
        XCTAssertTrue(app.staticTexts["Haptics"].waitForExistence(timeout: 15), "Settings never appeared")
        let online = app.buttons["Sync now"].exists
        XCTAssertEqual(
            app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'not configured'")).count, 0,
            "Players must never be shown backend setup text"
        )
        attach(online ? "verify-settings-online" : "verify-settings-offline")
    }

    /// In-app account deletion, which App Store guideline 5.1.1(v) requires of any app that creates
    /// accounts. Destructive: it deletes this simulator's anonymous account and wipes its progress.
    ///
    /// Needs a backend-configured build, a network connection, and migration 0003 applied. Cancel is
    /// checked first, so a player who backs out of the confirmation loses nothing.
    func testH_deleteMyData() {
        let app = launchApp()
        open(app, "cascade://settings")

        let deleteButton = app.buttons["Delete my data"]
        XCTAssertTrue(deleteButton.waitForExistence(timeout: 15), "Delete my data is missing - is a backend configured?")

        deleteButton.tap()
        let confirm = app.alerts["Delete your data?"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 5), "No confirmation before deleting")
        attach("verify-delete-confirm")
        confirm.buttons["Cancel"].tap()
        XCTAssertFalse(app.alerts["Data deleted"].waitForExistence(timeout: 3), "Cancel must not delete")

        deleteButton.tap()
        XCTAssertTrue(confirm.waitForExistence(timeout: 5))
        confirm.buttons["Delete"].tap()

        let deleted = app.alerts["Data deleted"]
        let failed = app.alerts["Couldn't delete your data"]
        XCTAssertTrue(
            deleted.waitForExistence(timeout: 20) || failed.exists,
            "Nothing told the player how the deletion went"
        )
        attach("verify-delete-result")
        XCTAssertTrue(deleted.exists, "Deletion failed - is migration 0003 applied, and is the simulator online?")
    }

    /// The records screen. Reads only; needs no network and deletes nothing, so it runs in the
    /// default suite.
    func testI_records() {
        let app = launchApp()
        open(app, "cascade://achievements")

        XCTAssertTrue(app.staticTexts["Records"].waitForExistence(timeout: 15), "Records never appeared")

        // Every row is one accessibility label built by describeRecord, so this asserts against
        // the exact string VoiceOver reads - the test and the screen reader fail together rather
        // than the app growing a label that exists only for automation.
        let unearned = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS 'not yet earned'"))
        XCTAssertGreaterThan(
            unearned.count, 0,
            "No record announced itself as unearned, so the rows are not describing themselves"
        )
        attach("verify-records")
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
