export const Footer = () => {
    return (
        <footer className="mt-8 sm:mt-16 py-6 sm:py-8 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-3 text-gray-600">
                <span className="text-xs sm:text-sm">© {new Date().getFullYear()} DojoPay. All rights reserved.</span>
            </div>
        </footer>
    );
};
