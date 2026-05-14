import { Button, Color, Graphics, Label, Layers, Node, UITransform } from 'cc';
import { kOnDarkButton } from '../configs/UiWarmPalette';

/**
 * 对局加载失败等场景下的极简错误视图（文案 + 返回按钮）。
 * 纯展示与单次回调，不包含业务判断。
 */

/**
 * 在根节点下挂载错误提示与返回按钮。
 * @param root UI 根节点（通常为 shell）
 * @param message 错误说明
 * @param onBack 点击返回时触发
 */
export function attachGameErrorView(root: Node, message: string, onBack: () => void): void {
    const n = new Node('err');
    n.layer = Layers.Enum.UI_2D;
    n.addComponent(UITransform).setContentSize(640, 40);
    const lb = n.addComponent(Label);
    lb.string = message;
    lb.fontSize = 22;
    lb.color = Color.RED;
    n.setPosition(0, 0, 0);
    root.addChild(n);

    const backN = new Node('back');
    backN.layer = Layers.Enum.UI_2D;
    backN.setPosition(0, -80, 0);
    backN.addComponent(UITransform).setContentSize(160, 48);
    const b = backN.addComponent(Button);
    b.transition = Button.Transition.SCALE;
    const gl = backN.addComponent(Graphics);
    gl.roundRect(-70, -20, 140, 40, 6);
    gl.fillColor = new Color(100, 100, 120, 255);
    gl.fill();
    const tl = new Node('t');
    tl.layer = Layers.Enum.UI_2D;
    tl.addComponent(UITransform).setContentSize(120, 36);
    const tlb = tl.addComponent(Label);
    tlb.string = '返回';
    tlb.fontSize = 22;
    tlb.color = kOnDarkButton;
    backN.addChild(tl);
    backN.on(Button.EventType.CLICK, onBack);
    root.addChild(backN);
}
