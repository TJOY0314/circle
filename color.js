export function safeColor(value, fallback = '#f3f6ed') {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

export function toRGB(value) {
  const hex = safeColor(value).slice(1);
  return [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
}

export function fromRGB(channels) {
  if (channels.length !== 3 || channels.some(value => !Number.isInteger(value) || value < 0 || value > 255)) {
    throw new RangeError('RGB 값은 0부터 255까지의 정수로 입력하세요.');
  }
  return '#' + channels.map(value => value.toString(16).padStart(2, '0')).join('');
}

export function textColor(value) {
  const [r, g, b] = toRGB(value).map(channel => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#17251d' : '#ffffff';
}
