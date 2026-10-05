//! The session's pseudo-random generator. It must stay bit-for-bit identical to the previous
//! engine so that a session seed always produces the same questions.

/// Linear congruential generator returning values in `[0, 1)`.
#[derive(Clone, Debug)]
pub struct Rng {
    state: u32,
}

impl Rng {
    pub fn new(seed: u32) -> Self {
        Self { state: seed }
    }

    #[allow(clippy::should_implement_trait)]
    pub fn next(&mut self) -> f64 {
        self.state = self
            .state
            .wrapping_mul(1_664_525)
            .wrapping_add(1_013_904_223);
        f64::from(self.state) / 4_294_967_296.0
    }

    /// An integer in `[min, max]`, drawn the way the previous engine drew it.
    pub fn integer(&mut self, min: i64, max: i64) -> i64 {
        min + (self.next() * (max - min + 1) as f64).floor() as i64
    }

    /// An index in `[0, length)`.
    pub fn index(&mut self, length: usize) -> usize {
        (self.next() * length as f64).floor() as usize
    }

    pub fn pick<T: Clone>(&mut self, values: &[T]) -> T {
        let index = self.index(values.len());
        values[index].clone()
    }

    /// Fisher-Yates from the end, consuming one draw per position.
    pub fn shuffle<T: Clone>(&mut self, values: &[T]) -> Vec<T> {
        let mut result = values.to_vec();
        let mut index = result.len();
        while index > 1 {
            index -= 1;
            let other = (self.next() * (index + 1) as f64).floor() as usize;
            result.swap(index, other);
        }
        result
    }
}

/// `Math.round`: ties go towards positive infinity.
pub fn js_round(value: f64) -> f64 {
    let floor = value.floor();
    if value - floor >= 0.5 {
        floor + 1.0
    } else {
        floor
    }
}
