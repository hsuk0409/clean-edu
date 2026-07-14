import { describe, it, expect } from 'vitest'
import { RepetitionDetector, similarity, splitRepeatedUnits } from './repetition'

describe('similarity', () => {
  it('동일 문자열은 1이다', () => {
    expect(similarity('환불해주세요', '환불해주세요')).toBe(1)
  })

  it('완전히 다른 문자열은 낮은 유사도를 갖는다', () => {
    expect(similarity('환불해주세요', '수업시간표')).toBeLessThan(0.3)
  })

  it('조사/어미만 다른 문장은 높은 유사도를 갖는다', () => {
    expect(similarity('환불해주세요', '환불해주세요라니까요')).toBeGreaterThan(0.5)
  })

  it('공백 차이는 무시한다', () => {
    expect(similarity('환불 해주세요', '환불해주세요')).toBe(1)
  })
})

describe('RepetitionDetector', () => {
  it('같은 내용이 requiredRepeats 미만이면 트리거되지 않는다', () => {
    const detector = new RepetitionDetector({ requiredRepeats: 3 })
    expect(detector.push('환불해주세요').triggered).toBe(false)
    expect(detector.push('환불해주세요').triggered).toBe(false)
  })

  it('같은 내용이 requiredRepeats에 도달하면 트리거된다', () => {
    const detector = new RepetitionDetector({ requiredRepeats: 3 })
    detector.push('환불해주세요')
    detector.push('환불해주세요')
    const result = detector.push('환불해주세요')
    expect(result.triggered).toBe(true)
    expect(result.count).toBe(3)
  })

  it('연속되지 않아도(다른 발화가 끼어도) 누적된다', () => {
    const detector = new RepetitionDetector({ requiredRepeats: 3 })
    detector.push('환불해주세요')
    detector.push('수업시간표 좀 알려주세요')
    detector.push('환불해주세요')
    const result = detector.push('환불해주세요')
    expect(result.triggered).toBe(true)
  })

  it('유사하지만 임계값 미만인 문장은 별개 클러스터로 취급한다', () => {
    const detector = new RepetitionDetector({ requiredRepeats: 2, similarityThreshold: 0.9 })
    detector.push('환불해주세요')
    const result = detector.push('수업시간표 좀 알려주세요')
    expect(result.triggered).toBe(false)
    expect(result.count).toBe(1)
  })

  it('빈 문자열/공백은 무시한다', () => {
    const detector = new RepetitionDetector()
    expect(detector.push('   ').count).toBe(0)
  })

  it('maxClusters를 초과하면 가장 오래된 클러스터가 밀려난다', () => {
    const detector = new RepetitionDetector({ maxClusters: 2, requiredRepeats: 2 })
    detector.push('주제A')
    detector.push('주제B')
    detector.push('주제C') // 주제A 클러스터가 밀려남
    const result = detector.push('주제A') // 새 클러스터로 취급되어야 함
    expect(result.count).toBe(1)
  })

  it('reset 이후에는 이전 반복 이력이 초기화된다', () => {
    const detector = new RepetitionDetector({ requiredRepeats: 2 })
    detector.push('환불해주세요')
    detector.reset()
    const result = detector.push('환불해주세요')
    expect(result.triggered).toBe(false)
    expect(result.count).toBe(1)
  })

  it('한 문장에 같은 말이 합쳐지면(STT 병합) 그 횟수만큼 집계해 트리거한다', () => {
    const detector = new RepetitionDetector({ requiredRepeats: 3 })
    const result = detector.push('안녕하세요 안녕하세요 안녕하세요')
    expect(result.count).toBe(3)
    expect(result.triggered).toBe(true)
  })

  it('병합된 반복과 이후 개별 발화가 함께 누적된다', () => {
    const detector = new RepetitionDetector({ requiredRepeats: 3 })
    expect(detector.push('환불해주세요 환불해주세요').triggered).toBe(false) // count 2
    expect(detector.push('환불해주세요').triggered).toBe(true) // count 3
  })

  it('일부만 겹치는 정상 문장은 반복으로 오인하지 않는다', () => {
    const detector = new RepetitionDetector({ requiredRepeats: 3 })
    const result = detector.push('네 네 네 알겠습니다')
    expect(result.count).toBe(1)
    expect(result.triggered).toBe(false)
  })
})

describe('splitRepeatedUnits', () => {
  it('공백으로 반복된 동일 토큰을 횟수로 분해한다', () => {
    expect(splitRepeatedUnits('안녕하세요 안녕하세요 안녕하세요', 0.5)).toEqual({
      unit: '안녕하세요',
      times: 3,
    })
  })

  it('공백 없이 붙은 정확한 주기 반복도 분해한다', () => {
    expect(splitRepeatedUnits('안녕안녕안녕', 0.5)).toEqual({ unit: '안녕', times: 3 })
  })

  it('반복이 아닌 일반 문장은 times 1로 둔다', () => {
    expect(splitRepeatedUnits('환불 해주세요', 0.5).times).toBe(1)
  })
})
