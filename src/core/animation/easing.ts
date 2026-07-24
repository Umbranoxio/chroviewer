const halfPi = Math.PI / 2;

function easeOutBounce(value: number) {
  const first = (121 / 16) * value * value;
  const secondValue = value - 6 / 11;
  const second = (363 / 40) * secondValue * secondValue + 7 / 10;
  const thirdValue = value - 179 / 220;
  const third = (4356 / 361) * thirdValue * thirdValue + 91 / 100;
  const fourthValue = value - 19 / 20;
  const fourth = (54 / 5) * fourthValue * fourthValue + 973 / 1000;
  return Math.min(first, second, third, fourth);
}

export function easing(value: number, name: string | undefined) {
  switch (name) {
    case 'easeStep':
      return Math.floor(value);
    case 'easeInQuad':
      return value * value;
    case 'easeOutQuad':
      return (2 - value) * value;
    case 'easeInOutQuad': {
      const x = value - 0.5;
      return (x - x * Math.abs(x)) * 2 + 0.5;
    }
    case 'easeInCubic':
      return value * value * value;
    case 'easeOutCubic':
      return 1 - (1 - value) ** 3;
    case 'easeInOutCubic': {
      const offset = value - 0.5;
      const absolute = Math.abs(offset);
      return ((4 * absolute - 6) * absolute + 3) * offset + 0.5;
    }
    case 'easeInQuart':
      return value ** 4;
    case 'easeOutQuart':
      return 1 - (1 - value) ** 4;
    case 'easeInOutQuart': {
      const offset = value - 0.5;
      const absolute = Math.abs(offset);
      return (((-8 * absolute + 16) * absolute - 12) * absolute + 4) * offset + 0.5;
    }
    case 'easeInQuint':
      return value ** 5;
    case 'easeOutQuint':
      return 1 - (1 - value) ** 5;
    case 'easeInOutQuint': {
      const offset = value - 0.5;
      const absolute = Math.abs(offset);
      return ((((16 * absolute - 40) * absolute + 40) * absolute - 20) * absolute + 5) * offset + 0.5;
    }
    case 'easeInSine':
      return 1 - Math.cos(halfPi * value);
    case 'easeOutSine':
      return Math.sin(halfPi * value);
    case 'easeInOutSine':
      return Math.sin(halfPi * value) ** 2;
    case 'easeInCirc':
      return 1 - Math.sqrt(Math.max(Number.EPSILON, 1 - value * value));
    case 'easeOutCirc':
      return Math.sqrt(Math.max(Number.EPSILON, (2 - value) * value));
    case 'easeInOutCirc':
      if (value < 0.5) return 0.5 - Math.sqrt(Math.max(Number.EPSILON, 0.25 - value * value));
      return 0.5 + Math.sqrt(Math.max(Number.EPSILON, 0.25 - (value - 1) ** 2));
    case 'easeInExpo':
      return value <= 0 ? value : 2 ** (10 * value) / 1023 - 1 / 1023;
    case 'easeOutExpo':
      return value > 1 ? value : 1024 / 1023 - (1024 / 1023) * 2 ** (-10 * value);
    case 'easeInOutExpo': {
      if (value > 1) return value;
      const shifted = value * 20 - 10;
      const scale = 512 / 1023;
      return shifted < 0 ? 0.5 - (scale - scale * 2 ** shifted) : 0.5 + (scale - scale * 2 ** -shifted);
    }
    case 'easeInElastic':
      return Math.sin(13 * halfPi * value) * 2 ** (10 * (value - 1));
    case 'easeOutElastic':
      return Math.sin(-13 * halfPi * (value + 1)) * 2 ** (-10 * value) + 1;
    case 'easeInOutElastic':
      return value < 0.5
        ? 0.5 * Math.sin(13 * halfPi * 2 * value) * 2 ** (10 * (2 * value - 1))
        : 0.5 * (Math.sin(-13 * halfPi * 2 * value) * 2 ** (-10 * (2 * value - 1)) + 2);
    case 'easeInBack':
      return value ** 3 - value * Math.sin(value * Math.PI);
    case 'easeOutBack': {
      const inverse = 1 - value;
      return 1 - (inverse ** 3 - inverse * Math.sin(inverse * Math.PI));
    }
    case 'easeInOutBack':
      if (value < 0.5) {
        const doubled = 2 * value;
        return 0.5 * (doubled ** 3 - doubled * Math.sin(doubled * Math.PI));
      } else {
        const inverse = 1 - (2 * value - 1);
        return 0.5 * (1 - (inverse ** 3 - inverse * Math.sin(inverse * Math.PI))) + 0.5;
      }
    case 'easeInBounce':
      return 1 - easeOutBounce(1 - value);
    case 'easeOutBounce':
      return easeOutBounce(value);
    case 'easeInOutBounce':
      return value < 0.5 ? 0.5 * (1 - easeOutBounce(1 - value * 2)) : 0.5 * easeOutBounce(value * 2 - 1) + 0.5;
    default:
      return value;
  }
}
