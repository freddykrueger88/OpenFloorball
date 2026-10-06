# 🚗 Carpool (Ridesharing)

*🇩🇪 [Deutsch](Carpool.md) | 🇬🇧 English*

Organize rides to games and trainings within your team. Team members
can offer a ride (meeting point as free text, free seats, optional
note), other members sign up – directly on the game or training
detail page, similar to RSVP and comments.

## Public Link

An additional **token-based public link** (`/carpool/:token`) allows
people **without their own account** (typically parents of youth
players) to sign up or withdraw their offer.

- The public link is the platform's first **anonymous write access**
- Dedicated, tighter rate limits protect against abuse
- Database transaction with row-level locking against overbooking
  under concurrency

## Privacy

- **No** address or phone fields
- The public view **never** exposes an email address
- Data minimization: only required data (meeting point, free seats,
  optional note)

## Usage

1. Open a game or training → "Carpool" section
2. Offer a ride: enter meeting point (free text), free seats, optional
   note
3. Share the public link (e.g. for parents without an account): "Copy
   link" button below the list
4. Other members/people sign up or cancel

---

> Changelog reference: Unreleased – Issue 028: Carpool, see
> [CHANGELOG.md](../../CHANGELOG.md)
