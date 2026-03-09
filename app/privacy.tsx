import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { colors, typography, spacing } from '../src/theme';

export default function PrivacyPolicyScreen() {
    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Privacy Policy',
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.text,
                    headerShadowVisible: false,
                }}
            />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.title}>Privacy Policy</Text>
                <Text style={styles.lastUpdated}>Last Updated: March 2026</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>1. Introduction</Text>
                    <Text style={styles.paragraph}>
                        Welcome to Zenyth. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you use our application and tell you about your privacy rights and how the law protects you.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>2. The Data We Collect</Text>
                    <Text style={styles.paragraph}>
                        We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:
                    </Text>
                    <Text style={styles.listItem}>• <Text style={styles.bold}>Email Address (Contact Info):</Text> We collect your email address for account creation, authentication, and communication regarding your account (App Functionality).</Text>
                    <Text style={styles.listItem}>• <Text style={styles.bold}>Product Interaction (Usage Data):</Text> We collect data on how you interact with our application. This data is linked to your identity and is used for App Functionality and Analytics to improve your experience.</Text>
                    <Text style={styles.listItem}>• <Text style={styles.bold}>Performance Data (Diagnostics):</Text> We collect crash logs, performance, and diagnostic data to help us identify and resolve issues, ensuring a stable and reliable app experience.</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>3. How We Use Your Data</Text>
                    <Text style={styles.paragraph}>
                        We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:
                    </Text>
                    <Text style={styles.listItem}>• Where we need to perform the contract we are about to enter into or have entered into with you (providing App Functionality and account access).</Text>
                    <Text style={styles.listItem}>• Where it is necessary for our legitimate interests to improve our products and services (Analytics and Diagnostics).</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>4. Data Security</Text>
                    <Text style={styles.paragraph}>
                        We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorised way, altered or disclosed. In addition, we limit access to your personal data to those employees, agents, contractors and other third parties who have a business need to know.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>5. Your Legal Rights</Text>
                    <Text style={styles.paragraph}>
                        Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to request access, correction, erasure, or restriction of processing of your personal data.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>6. Contact Us</Text>
                    <Text style={styles.paragraph}>
                        If you have any questions about this privacy policy or our privacy practices, please contact us through our official support channels within the application.
                    </Text>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>© 2026 Zenyth. All rights reserved.</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        padding: spacing.xl,
        paddingBottom: spacing.xxl * 2,
    },
    title: {
        ...typography.h1,
        marginBottom: spacing.xs,
    },
    lastUpdated: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        marginBottom: spacing.xl,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        ...typography.h3,
        marginBottom: spacing.sm,
    },
    paragraph: {
        ...typography.body,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    listItem: {
        ...typography.body,
        color: colors.text,
        marginLeft: spacing.md,
        marginBottom: spacing.xs,
    },
    bold: {
        fontFamily: typography.h3.fontFamily,
    },
    footer: {
        marginTop: spacing.xl,
        paddingTop: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        alignItems: 'center',
    },
    footerText: {
        ...typography.bodySmall,
    },
});
