# Betcaster - Peer-to-Peer Betting Protocol on Farcaster 🎲

Betcaster is a decentralized peer-to-peer betting protocol built on Farcaster that allows users to create, accept, and settle bets with the help of arbiters. Built on Base blockchain, it provides a secure and transparent way to make agreements with friends and community members.

## Features

- **Create Bets**: Set up bets with custom amounts, descriptions, and timeframes
- **Accept Bets**: Browse and accept open bets from other users
- **Arbiter System**: Third-party arbiters can settle disputes and determine winners
- **Early Settlement**: Optional early settlement feature for clear outcomes
- **Token Support**: Support for ETH and ERC-20 tokens on Base (Does NOT support rebase tokens!)
- **Farcaster Integration**: Seamless integration with Farcaster social features
- **Real-time Notifications**: Get notified about bet updates and invitations

## How It Works

1. **Maker Creates Bet**: A user creates a bet with a clear true/false statement, amount, and timeframe
2. **Taker Accepts**: Another user can accept the bet by matching the amount
3. **Arbiter Joins**: A third party accepts the role of arbiter to judge the outcome
4. **Settlement**: After the end time (or earlier if enabled), the arbiter declares the winner
5. **Payout**: Winners claim their winnings minus protocol and arbiter fees

## Getting Started

### Prerequisites

- A Farcaster account
- A Base-compatible wallet (like Farcaster or The Base App)
- Some ETH or tokens on Base for betting

## Smart Contracts

Betcaster uses three main smart contracts deployed on Base:

- **Betcaster**: Stores smart contract state, non-upgradable and immutable
- **Bet Management Engine**: Handles bet creation, acceptance, and basic operations
- **Arbiter Management Engine**: Manages arbiter selection and winner determination

## API Endpoints

The app includes several API routes for managing bets and user data:

- `/api/bets` - CRUD operations for bets
- `/api/users` - User profile management
- `/api/search-users` - Search for Farcaster users
- `/api/auth/[...nextauth]` - Authentication handling

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, questions, or to report bugs, please open an issue on GitHub or reach out to the team on Farcaster.

---

Built with ❤️ for the Farcaster community
