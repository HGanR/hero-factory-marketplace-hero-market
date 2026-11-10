# Mobile registration and PayPal purchase-link events

The mobile sign-in page adds Register an Account with email and username. It forwards to the canonical website registration service, which must commit the pending account and registration analytics together. Existing approved website credentials remain the mobile sign-in credentials. New accounts wait for administrator approval and the generated password; no local password, simulated email verification or automatic approval is added.

The member profile adopts the supplied PayPal payment link. Its same-origin event proxy fixes eventName mobile.troo_token.paypal.open, eventType outbound_paypal and analytics label **Mobile app TROO Token purchases**. This measures the purchase-link trigger, not settlement or token delivery. No browser cookies, credentials or member images are forwarded to analytics or PayPal. The outbound link uses noopener/noreferrer. Canonical registration and analytics endpoints are fixed HTTPS website URLs; redirects are refused.

Publish the matching website registration/briefing update before this mobile update. The mobile account endpoint refuses to submit to an older registration backend. Neither the new form nor test fixtures prove actual email delivery, payment completion, token fulfillment or live database parity. No schema migration is introduced.
