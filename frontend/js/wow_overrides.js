/* Slide the QT settings gear in and out at the same speed. */
(()=>{
  const closed = {width:'0px', minWidth:'0px', marginLeft:'0px', opacity:0};
  const open = {width:'32px', minWidth:'32px', marginLeft:'2px', opacity:1};
  const closedTransform = 'translateX(-14px) rotate(-180deg)';
  const top = () => document.getElementById('topbar');
  const gear = () => document.getElementById('btn-qt-settings');
  let closeTimer;
  let hot = false;

  function setHot(next) {
    clearTimeout(closeTimer);
    if (next === hot) return;
    const button = gear();
    if (!button) return;

    // Start at the current position if the pointer changes direction mid-animation.
    const style = getComputedStyle(button);
    const current = {width:style.width, minWidth:style.minWidth, marginLeft:style.marginLeft, opacity:style.opacity};
    const transform = style.transform;
    button.getAnimations().forEach(animation => animation.cancel());
    hot = next;
    top()?.classList.toggle('qt-hot', next);
    button.animate([current, next ? open : closed], {
      duration:520, easing:'cubic-bezier(.2,.9,.3,1)', fill:'forwards'
    });
    button.animate([{transform}, {transform:next ? 'none' : closedTransform}], {
      duration:720, easing:'cubic-bezier(.3,1.55,.5,1)', fill:'forwards'
    });
    if (next) {
      document.getElementById('btn-indicator')?.animate(
        [{transform:'scale(1)'}, {transform:'scale(1.06)', offset:.35}, {transform:'scale(1)'}],
        {duration:520, easing:'ease-out'}
      );
    }
  }

  const isQtControl = target => Boolean(target?.closest?.('#btn-indicator, #btn-qt-settings'));
  const attached = new WeakSet();
  function hold(button) {
    if (!button || attached.has(button)) return;
    attached.add(button);
    button.addEventListener('mouseenter', () => setHot(true));
    button.addEventListener('mouseleave', event => {
      if (!isQtControl(event.relatedTarget)) {
        // Allow a quick crossing of the small gap between the two buttons.
        clearTimeout(closeTimer);
        closeTimer = setTimeout(() => setHot(false), 40);
      }
    });
    button.addEventListener('focusin', () => setHot(true));
    button.addEventListener('focusout', event => {
      if (!isQtControl(event.relatedTarget) && !top()?.querySelector(':is(#btn-indicator, #btn-qt-settings):hover')) {
        setHot(false);
      }
    });
  }
  const attach = () => { hold(document.getElementById('btn-indicator')); hold(gear()); };
  new MutationObserver(attach).observe(document.body, {childList:true, subtree:true});
  document.addEventListener('DOMContentLoaded', attach);
  attach();
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setHot(false);
  });
})();
