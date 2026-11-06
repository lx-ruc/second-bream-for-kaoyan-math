// 编译产物不入库；test-e2e.js 首次运行时用 swiftc 现场构建。
// 存在意义：微信开发者工具每次启动都弹「更新提示」原生弹窗，会堵死自动化指令通道
// （Tool.getInfo 等全部超时），只能真实点击「稍后再说」。CGEvent 走的是辅助功能权限，
// 终端已授权，子进程继承。
import CoreGraphics
import Foundation

let args = CommandLine.arguments
guard args.count >= 3,
      let x = Double(args[1]), let y = Double(args[2]) else {
    FileHandle.standardError.write("usage: click x y\n".data(using: .utf8)!)
    exit(2)
}
let pt = CGPoint(x: x, y: y)
let move = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: pt, mouseButton: .left)!
let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: pt, mouseButton: .left)!
let up = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: pt, mouseButton: .left)!
move.post(tap: .cghidEventTap)
usleep(120_000)
down.post(tap: .cghidEventTap)
usleep(80_000)
up.post(tap: .cghidEventTap)
