// 与 click.swift 配套：往焦点处发组合键（默认 cmd+v 粘贴）。
// 用法：key.bin [a-z]
import CoreGraphics
import Foundation

let kVK_ANSI_A: CGKeyCode = 0
let keyChar = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "v"
let lower = keyChar.lowercased().unicodeScalars.first!.value
guard lower >= 97 && lower <= 122 else {
    FileHandle.standardError.write("only a-z\n".data(using: .utf8)!)
    exit(2)
}
let vkey = CGKeyCode(lower - 97) + kVK_ANSI_A
let src = CGEventSource(stateID: CGEventSourceStateID.combinedSessionState)
let down = CGEvent(keyboardEventSource: src, virtualKey: vkey, keyDown: true)!
let up = CGEvent(keyboardEventSource: src, virtualKey: vkey, keyDown: false)!
down.flags = CGEventFlags.maskCommand
up.flags = CGEventFlags.maskCommand
down.post(tap: CGEventTapLocation.cghidEventTap)
usleep(60_000)
up.post(tap: CGEventTapLocation.cghidEventTap)
