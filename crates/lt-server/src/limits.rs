//! Request rate limits for sensitive endpoints.

use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use axum::extract::ConnectInfo;
use axum::http::{Extensions, HeaderMap};

/// At most `limit` requests per key in each window of `window`.
pub struct RateLimiter {
    limit: u32,
    window: Duration,
    counts: Mutex<HashMap<IpAddr, (Instant, u32)>>,
}

impl RateLimiter {
    pub fn new(limit: u32, window: Duration) -> Self {
        Self {
            limit,
            window,
            counts: Mutex::new(HashMap::new()),
        }
    }

    /// Records a request; false when the key is over its limit.
    pub fn allow(&self, key: IpAddr, now: Instant) -> bool {
        let mut counts = self
            .counts
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if counts.len() > 10_000 {
            counts.retain(|_, (start, _)| now.duration_since(*start) < self.window);
        }
        let entry = counts.entry(key).or_insert((now, 0));
        if now.duration_since(entry.0) >= self.window {
            *entry = (now, 0);
        }
        entry.1 += 1;
        entry.1 <= self.limit
    }
}

/// The client address. `X-Forwarded-For` is trusted only from the loopback, that is from Caddy.
pub fn client_ip(headers: &HeaderMap, extensions: &Extensions) -> IpAddr {
    let peer_ip = extensions
        .get::<ConnectInfo<SocketAddr>>()
        .map_or(IpAddr::from([127, 0, 0, 1]), |info| info.0.ip());
    if !peer_ip.is_loopback() {
        return peer_ip;
    }
    headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .and_then(|first| first.trim().parse().ok())
        .unwrap_or(peer_ip)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn limits_each_address_per_window() {
        let limiter = RateLimiter::new(2, Duration::from_secs(60));
        let start = Instant::now();
        let first = IpAddr::from([10, 0, 0, 1]);
        assert!(limiter.allow(first, start));
        assert!(limiter.allow(first, start));
        assert!(!limiter.allow(first, start));
        assert!(limiter.allow(IpAddr::from([10, 0, 0, 2]), start));
        assert!(limiter.allow(first, start + Duration::from_secs(61)));
    }

    #[test]
    fn trusts_forwarded_addresses_only_from_the_proxy() {
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-for", "203.0.113.7, 10.0.0.1".parse().unwrap());
        let with_peer = |address: [u8; 4]| {
            let mut extensions = Extensions::new();
            extensions.insert(ConnectInfo(SocketAddr::from((address, 5000))));
            extensions
        };
        assert_eq!(
            client_ip(&headers, &with_peer([127, 0, 0, 1])),
            IpAddr::from([203, 0, 113, 7])
        );
        assert_eq!(
            client_ip(&headers, &with_peer([198, 51, 100, 2])),
            IpAddr::from([198, 51, 100, 2])
        );
    }
}
