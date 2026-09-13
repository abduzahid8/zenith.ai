import { useLocalSearchParams } from 'expo-router';
import PublicVerificationScreen from '../../src/screens/PublicVerificationScreen';

export default function VerifyCredentialRoute() {
    const params = useLocalSearchParams();
    const credentialId = String(params.credentialId ?? '');
    return <PublicVerificationScreen credentialId={credentialId} />;
}
