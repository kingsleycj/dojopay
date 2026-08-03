import { config } from "../config/index.js";
function emit(level, message, fields) {
    const line = {
        level,
        time: new Date().toISOString(),
        message,
        ...fields,
    };
    const serialized = JSON.stringify(line, (_key, value) => typeof value === "bigint" ? value.toString() : value);
    if (level === "error")
        console.error(serialized);
    else if (level === "warn")
        console.warn(serialized);
    else
        console.log(serialized);
}
export const logger = {
    debug(message, fields) {
        if (config.isProduction || config.isTest)
            return;
        emit("debug", message, fields);
    },
    info(message, fields) {
        if (config.isTest)
            return;
        emit("info", message, fields);
    },
    warn(message, fields) {
        if (config.isTest)
            return;
        emit("warn", message, fields);
    },
    error(message, fields) {
        emit("error", message, fields);
    },
};
//# sourceMappingURL=logger.js.map