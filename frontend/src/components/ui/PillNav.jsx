import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

const PillNav = ({
  logo,
  logoAlt = 'Logo',
  items = [],
  activeHref,
  className = '',
  ease = 'power3.easeOut',
  baseColor = '#e9d5ff',
  pillColor = '#5b21b6',
  hoveredPillTextColor = '#2e1065',
  pillTextColor,
  onNavigate
}) => {
  const resolvedPillTextColor = pillTextColor ?? '#ede9fe';

  const circleRefs = useRef([]);
  const tlRefs = useRef([]);
  const activeTweenRefs = useRef([]);

  useEffect(() => {
    const layout = () => {
      circleRefs.current.forEach(circle => {
        if (!circle?.parentElement) return;

        const pill = circle.parentElement;
        const rect = pill.getBoundingClientRect();
        const { width: w, height: h } = rect;
        const R = ((w * w) / 4 + h * h) / (2 * h);
        const D = Math.ceil(2 * R) + 2;
        const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
        const originY = D - delta;

        circle.style.width = `${D}px`;
        circle.style.height = `${D}px`;
        circle.style.bottom = `-${delta}px`;

        gsap.set(circle, {
          xPercent: -50,
          scale: 0,
          transformOrigin: `50% ${originY}px`
        });

        const label = pill.querySelector('.pill-label');
        const white = pill.querySelector('.pill-label-hover');

        if (label) gsap.set(label, { y: 0 });
        if (white) gsap.set(white, { y: h + 12, opacity: 0 });

        const index = circleRefs.current.indexOf(circle);
        if (index === -1) return;

        tlRefs.current[index]?.kill();
        const tl = gsap.timeline({ paused: true });

        tl.to(circle, { scale: 1.15, duration: 2, ease }, 0);
        if (label) tl.to(label, { y: -(h + 8), duration: 2, ease }, 0);
        if (white) tl.to(white, { y: 0, opacity: 1, duration: 2, ease }, 0);

        tlRefs.current[index] = tl;
      });
    };

    layout();
    window.addEventListener('resize', layout);
    return () => window.removeEventListener('resize', layout);
  }, [items, ease]);

  const handleEnter = i => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(tl.duration(), {
      duration: 0.3,
      ease,
      overwrite: 'auto'
    });
  };

  const handleLeave = i => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(0, {
      duration: 0.2,
      ease,
      overwrite: 'auto'
    });
  };

  const cssVars = {
    ['--base']: baseColor,
    ['--pill-bg']: pillColor,
    ['--hover-text']: hoveredPillTextColor,
    ['--pill-text']: resolvedPillTextColor,
    ['--nav-h']: '44px',
    ['--logo']: '36px',
    ['--pill-pad-x']: '26px',
    ['--pill-gap']: '10px'
  };

  return (
    <div className="absolute top-4 left-0 w-full z-50 flex justify-center">
      <nav className={`flex items-center justify-center ${className}`} style={cssVars}>
        <div
          className="flex items-center rounded-full px-4 py-2 backdrop-blur-md border"
          style={{
            height: 'var(--nav-h)',
            background: 'rgba(91,33,182,0.18)',
            borderColor: 'rgba(167,139,250,0.35)'
          }}
        >
          {logo && (
            <div
              className="flex items-center gap-2 pr-4 mr-2 border-r"
              style={{ borderColor: 'rgba(167,139,250,0.35)' }}
            >
              <img src={logo} alt={logoAlt} className="h-6 w-6 object-contain" />
              <span className="text-sm font-semibold text-violet-200">DiMITO</span>
            </div>
          )}

          <ul className="flex items-center" style={{ gap: 'var(--pill-gap)' }}>
            {items.map((item, i) => {
              const isActive = activeHref === item.href;

              const handleClick = (e) => {
                e.preventDefault();
                if (onNavigate && item.href) {
                  onNavigate(item.href);
                }
              };

              const pillStyle = {
                background: 'var(--pill-bg)',
                color: 'var(--pill-text)',
                paddingLeft: 'var(--pill-pad-x)',
                paddingRight: 'var(--pill-pad-x)'
              };

              return (
                <li key={item.label || i} className="relative h-full">
                  <button
                    type="button"
                    className="relative overflow-hidden inline-flex items-center justify-center h-full rounded-full font-semibold uppercase text-sm cursor-pointer"
                    style={pillStyle}
                    onClick={handleClick}
                    onMouseEnter={() => handleEnter(i)}
                    onMouseLeave={() => handleLeave(i)}
                  >
                    <span
                      ref={el => (circleRefs.current[i] = el)}
                      className="absolute left-1/2 bottom-0 rounded-full pointer-events-none z-[1]"
                      style={{ background: 'var(--base)' }}
                    />
                    <span className="label-stack relative inline-block leading-[1] z-[2]">
                      <span className="pill-label relative z-[2] inline-block leading-[1]">
                        {item.label}
                      </span>
                      <span
                        className="pill-label-hover absolute left-0 top-0 z-[3] inline-block"
                        style={{ color: 'var(--hover-text)' }}
                      >
                        {item.label}
                      </span>
                    </span>
                    {isActive && (
                      <span
                        className="absolute left-1/2 -bottom-[6px] -translate-x-1/2 w-3 h-3 rounded-full z-[4]"
                        style={{ background: 'var(--base)' }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </div>
  );
};

export default PillNav;